const prisma = require('../../lib/prisma');
const crypto = require('crypto');

/*
 * Customer Khata (simple ledger)
 * ------------------------------
 * - Every sale bill is a debit: the part not paid at the counter (total - paid) is added to the balance.
 * - Every row in "CustomerPayment" is a khata entry:
 *     amount > 0  => payment received (balance goes down)
 *     amount < 0  => balance increased (opening balance / manual increase)
 * - customer.balance is the running total.
 * Payments are stored exactly as received. They are NOT split or allocated across sale invoices.
 */

// Ensure CustomerPayment table exists in Postgres database
let tableInitialized = false;
const ensurePaymentTableExists = async () => {
  if (tableInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CustomerPayment" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "customerId" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "paymentMethod" TEXT DEFAULT 'Cash',
        "receiptId" TEXT,
        "receiptNo" TEXT,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CustomerPayment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    // ledgerV2 = true for entries saved by the simple ledger (never split across invoices).
    // Old rows stay false until the one-time ledger repair has been applied.
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "CustomerPayment" ADD COLUMN IF NOT EXISTS "ledgerV2" BOOLEAN NOT NULL DEFAULT false;
    `);
    tableInitialized = true;
  } catch (err) {
    console.error('CustomerPayment table initialization check:', err.message);
  }
};

// Helper to fetch khata entries for customers
const getCustomerPayments = async (customerIds, userId) => {
  if (!customerIds || customerIds.length === 0) return {};
  try {
    await ensurePaymentTableExists();
    const payments = await prisma.$queryRawUnsafe(`
      SELECT * FROM "CustomerPayment"
      WHERE "userId" = $1 AND "customerId" = ANY($2::text[])
      ORDER BY "createdAt" DESC
    `, userId, customerIds);

    const map = {};
    for (const p of payments) {
      if (!map[p.customerId]) map[p.customerId] = [];
      map[p.customerId].push(p);
    }
    return map;
  } catch (err) {
    console.error('Error fetching customer payments:', err.message);
    return {};
  }
};

// Helper to write one khata entry (db can be prisma or a transaction client)
const insertPaymentRecord = async (db, { userId, customerId, amount, paymentMethod, notes, date }) => {
  await db.$executeRawUnsafe(`
    INSERT INTO "CustomerPayment" ("id", "userId", "customerId", "amount", "paymentMethod", "receiptId", "receiptNo", "notes", "createdAt", "ledgerV2")
    VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6, $7, true)
  `, crypto.randomUUID(), userId, customerId, amount, paymentMethod || 'Cash', notes || null, date || new Date());
};

const customerInclude = {
  sales: {
    orderBy: { createdAt: 'desc' },
    include: { items: true }
  }
};

// Shape a customer for the client (adds totals + khata entries)
const formatCustomer = (c, payments) => ({
  ...c,
  totalSpent: (c.sales || []).reduce((sum, s) => sum + (s.totalAmount || 0), 0),
  visits: (c.sales || []).length,
  payments: payments || []
});

const fetchFormattedCustomer = async (id, userId) => {
  const customer = await prisma.customer.findFirst({
    where: { id, userId },
    include: customerInclude
  });
  if (!customer) return null;
  const paymentsMap = await getCustomerPayments([id], userId);
  return formatCustomer(customer, paymentsMap[id]);
};

// @desc  Get all customers
// @route GET /api/customers
const getCustomers = async (req, res) => {
  try {
    await ensurePaymentTableExists();

    const customers = await prisma.customer.findMany({
      where: { userId: req.user.id },
      orderBy: { name: 'asc' },
      include: customerInclude
    });

    const paymentsMap = await getCustomerPayments(customers.map(c => c.id), req.user.id);
    return res.status(200).json(customers.map(c => formatCustomer(c, paymentsMap[c.id])));
  } catch (error) {
    console.error('Get customers error:', error);
    return res.status(500).json({ message: 'Server error fetching customers' });
  }
};

// @desc  Receive customer payment (records the payment as-is and reduces the khata balance)
// @route POST /api/customers/:id/payment
const receivePayment = async (req, res) => {
  try {
    await ensurePaymentTableExists();
    const { id } = req.params;
    const { amount, paymentMethod, notes, date } = req.body;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'Please provide a valid payment amount greater than 0' });
    }

    const customer = await prisma.customer.findFirst({
      where: { id, userId: req.user.id }
    });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    if (parsedAmount > (customer.balance || 0) + 0.01) {
      return res.status(400).json({
        message: `Payment amount cannot exceed customer balance of ${(customer.balance || 0).toFixed(2)}`
      });
    }

    const actualPayment = Math.min(parsedAmount, customer.balance || 0);
    const paymentDate = date && !isNaN(Date.parse(date)) ? new Date(date) : new Date();

    await prisma.$transaction(async (tx) => {
      await insertPaymentRecord(tx, {
        userId: req.user.id,
        customerId: id,
        amount: actualPayment,
        paymentMethod,
        notes: notes ? String(notes).trim() : null,
        date: paymentDate
      });
      await tx.customer.update({
        where: { id },
        data: { balance: { decrement: actualPayment } }
      });
    }, { maxWait: 10000, timeout: 20000 });

    const updated = await fetchFormattedCustomer(id, req.user.id);
    return res.status(200).json({ ...updated, message: 'Payment received successfully' });
  } catch (error) {
    console.error('Receive payment error:', error);
    return res.status(500).json({ message: error.message || 'Server error processing payment' });
  }
};

// @desc  Create a customer
// @route POST /api/customers
const createCustomer = async (req, res) => {
  try {
    await ensurePaymentTableExists();
    const { name, phone, email, address, loyaltyPoints, balance } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const openingBalance = parseFloat(balance) || 0;

    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          name,
          phone: phone || null,
          email: email || null,
          address: address || null,
          loyaltyPoints: parseInt(loyaltyPoints) || 0,
          balance: openingBalance,
          userId: req.user.id
        }
      });

      // Record opening balance as a khata entry so the ledger always adds up
      if (Math.abs(openingBalance) > 0.001) {
        await insertPaymentRecord(tx, {
          userId: req.user.id,
          customerId: created.id,
          amount: -openingBalance,
          paymentMethod: 'Opening Balance',
          notes: 'Opening balance'
        });
      }
      return created;
    }, { maxWait: 10000, timeout: 20000 });

    const formatted = await fetchFormattedCustomer(customer.id, req.user.id);
    return res.status(201).json(formatted);
  } catch (error) {
    console.error('Create customer error:', error);
    return res.status(500).json({ message: 'Server error creating customer' });
  }
};

// @desc  Update a customer
// @route PUT /api/customers/:id
const updateCustomer = async (req, res) => {
  try {
    await ensurePaymentTableExists();
    const { id } = req.params;
    const { name, phone, email, address, loyaltyPoints, balance } = req.body;

    const existing = await prisma.customer.findFirst({
      where: { id, userId: req.user.id }
    });
    if (!existing) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    let newBalance = existing.balance;
    if (balance !== undefined && balance !== null && balance !== '') {
      const parsed = parseFloat(balance);
      if (isNaN(parsed)) {
        return res.status(400).json({ message: 'Balance must be a valid number' });
      }
      newBalance = parsed;
    }
    const balanceDiff = (existing.balance || 0) - newBalance; // > 0 means balance reduced

    await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id },
        data: {
          name: name !== undefined ? name : existing.name,
          phone: phone !== undefined ? phone : existing.phone,
          email: email !== undefined ? email : existing.email,
          address: address !== undefined ? address : existing.address,
          loyaltyPoints: loyaltyPoints !== undefined ? (parseInt(loyaltyPoints) || 0) : existing.loyaltyPoints,
          balance: newBalance
        }
      });

      // A manual balance change is recorded as a khata entry so the ledger stays correct
      if (Math.abs(balanceDiff) > 0.001) {
        await insertPaymentRecord(tx, {
          userId: req.user.id,
          customerId: id,
          amount: balanceDiff,
          paymentMethod: 'Balance Adjustment',
          notes: `Manual balance edit: ${(existing.balance || 0).toFixed(2)} -> ${newBalance.toFixed(2)}`
        });
      }
    }, { maxWait: 10000, timeout: 20000 });

    const formatted = await fetchFormattedCustomer(id, req.user.id);
    return res.status(200).json(formatted);
  } catch (error) {
    console.error('Update customer error:', error);
    return res.status(500).json({ message: 'Server error updating customer' });
  }
};

// @desc  Bulk delete customers
// @route DELETE /api/customers
const deleteCustomers = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Customer IDs are required' });
    }

    await prisma.customer.deleteMany({
      where: { id: { in: ids }, userId: req.user.id }
    });

    return res.status(200).json({ message: 'Customer(s) deleted successfully' });
  } catch (error) {
    console.error('Delete customers error:', error);
    return res.status(500).json({ message: 'Server error deleting customers' });
  }
};

module.exports = {
  ensurePaymentTableExists,
  getCustomers,
  receivePayment,
  createCustomer,
  updateCustomer,
  deleteCustomers
};
