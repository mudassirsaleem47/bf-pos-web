const prisma = require('../../lib/prisma');

// Helper to allocate payment across customer sales in FIFO order
const allocatePaymentToSales = async (prismaTx, customerId, userId, amount) => {
  if (!amount || amount <= 0) return 0;
  
  const unpaidSales = await prismaTx.saleTransaction.findMany({
    where: {
      customerId,
      userId
    },
    orderBy: { createdAt: 'asc' }
  });

  let remaining = amount;
  let totalAllocated = 0;

  for (const sale of unpaidSales) {
    const due = Math.max(0, sale.totalAmount - sale.paidAmount);
    if (due > 0.001) {
      const toPay = Math.min(remaining, due);
      if (toPay > 0) {
        await prismaTx.saleTransaction.update({
          where: { id: sale.id },
          data: {
            paidAmount: { increment: toPay }
          }
        });
        remaining -= toPay;
        totalAllocated += toPay;
        if (remaining <= 0.001) break;
      }
    }
  }

  return totalAllocated;
};

// @desc  Get all customers
// @route GET /api/customers
const getCustomers = async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { userId: req.user.id },
      orderBy: { name: 'asc' },
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
          include: { items: true }
        }
      }
    });

    // Auto-reconcile any past unallocated payments where customer balance was reduced without updating sales
    let needsRefetch = false;
    for (const customer of customers) {
      const totalSalesAmount = (customer.sales || []).reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      const totalSalesPaid = (customer.sales || []).reduce((sum, s) => sum + (s.paidAmount || 0), 0);
      const calculatedDue = Math.max(0, totalSalesAmount - totalSalesPaid);
      const unallocated = calculatedDue - (customer.balance || 0);

      if (unallocated > 0.01) {
        needsRefetch = true;
        await prisma.$transaction(async (tx) => {
          await allocatePaymentToSales(tx, customer.id, req.user.id, unallocated);
        });
      }
    }

    const finalCustomers = needsRefetch
      ? await prisma.customer.findMany({
          where: { userId: req.user.id },
          orderBy: { name: 'asc' },
          include: {
            sales: {
              orderBy: { createdAt: 'desc' },
              include: { items: true }
            }
          }
        })
      : customers;

    const formatted = finalCustomers.map(c => {
      const totalSpent = (c.sales || []).reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      const visits = (c.sales || []).length;
      return {
        ...c,
        totalSpent,
        visits
      };
    });

    return res.status(200).json(formatted);
  } catch (error) {
    console.error('Get customers error:', error);
    return res.status(500).json({ message: 'Server error fetching customers' });
  }
};

// @desc  Receive customer payment (settles customer balance and updates sales paidAmount)
// @route POST /api/customers/:id/payment
const receivePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, receiptId } = req.body;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'Please provide a valid payment amount greater than 0' });
    }

    const customer = await prisma.customer.findFirst({
      where: { id, userId: req.user.id },
      include: { sales: { orderBy: { createdAt: 'asc' } } }
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    if (parsedAmount > (customer.balance || 0) + 0.01) {
      return res.status(400).json({ 
        message: `Payment amount cannot exceed customer balance of ${(customer.balance || 0).toFixed(2)}` 
      });
    }

    const actualPayment = Math.min(parsedAmount, customer.balance);

    await prisma.$transaction(async (tx) => {
      if (receiptId && receiptId !== 'ALL') {
        const sale = await tx.saleTransaction.findFirst({
          where: { id: receiptId, customerId: id, userId: req.user.id }
        });
        if (!sale) {
          throw new Error('Receipt not found for this customer');
        }
        const saleDue = Math.max(0, sale.totalAmount - sale.paidAmount);
        const payToSale = Math.min(actualPayment, saleDue);
        
        await tx.saleTransaction.update({
          where: { id: sale.id },
          data: {
            paidAmount: { increment: payToSale }
          }
        });

        await tx.customer.update({
          where: { id },
          data: {
            balance: Math.max(0, (customer.balance || 0) - payToSale)
          }
        });
      } else {
        await allocatePaymentToSales(tx, id, req.user.id, actualPayment);
        await tx.customer.update({
          where: { id },
          data: {
            balance: Math.max(0, (customer.balance || 0) - actualPayment)
          }
        });
      }
    });

    const updatedCustomer = await prisma.customer.findFirst({
      where: { id, userId: req.user.id },
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
          include: { items: true }
        }
      }
    });

    const totalSpent = (updatedCustomer.sales || []).reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const visits = (updatedCustomer.sales || []).length;

    return res.status(200).json({
      ...updatedCustomer,
      totalSpent,
      visits,
      message: 'Payment received successfully'
    });
  } catch (error) {
    console.error('Receive payment error:', error);
    return res.status(500).json({ message: error.message || 'Server error processing payment' });
  }
};

// @desc  Create a customer
// @route POST /api/customers
const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, address, loyaltyPoints, balance } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        loyaltyPoints: parseInt(loyaltyPoints) || 0,
        balance: parseFloat(balance) || 0,
        userId: req.user.id
      },
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
          include: { items: true }
        }
      }
    });

    return res.status(201).json({
      ...customer,
      totalSpent: 0,
      visits: 0
    });
  } catch (error) {
    console.error('Create customer error:', error);
    return res.status(500).json({ message: 'Server error creating customer' });
  }
};

// @desc  Update a customer
// @route PUT /api/customers/:id
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, loyaltyPoints, balance } = req.body;

    const existing = await prisma.customer.findFirst({
      where: { id, userId: req.user.id }
    });
    if (!existing) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const newBalance = balance !== undefined ? parseFloat(balance) : existing.balance;

    if (balance !== undefined && newBalance < existing.balance) {
      const paidDiff = existing.balance - newBalance;
      await prisma.$transaction(async (tx) => {
        await allocatePaymentToSales(tx, id, req.user.id, paidDiff);
        await tx.customer.update({
          where: { id },
          data: {
            name: name !== undefined ? name : existing.name,
            phone: phone !== undefined ? phone : existing.phone,
            email: email !== undefined ? email : existing.email,
            address: address !== undefined ? address : existing.address,
            loyaltyPoints: loyaltyPoints !== undefined ? parseInt(loyaltyPoints) : existing.loyaltyPoints,
            balance: newBalance
          }
        });
      });
    } else {
      await prisma.customer.update({
        where: { id },
        data: {
          name: name !== undefined ? name : existing.name,
          phone: phone !== undefined ? phone : existing.phone,
          email: email !== undefined ? email : existing.email,
          address: address !== undefined ? address : existing.address,
          loyaltyPoints: loyaltyPoints !== undefined ? parseInt(loyaltyPoints) : existing.loyaltyPoints,
          balance: newBalance
        }
      });
    }

    const customer = await prisma.customer.findFirst({
      where: { id, userId: req.user.id },
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
          include: { items: true }
        }
      }
    });

    const totalSpent = (customer.sales || []).reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const visits = (customer.sales || []).length;

    return res.status(200).json({
      ...customer,
      totalSpent,
      visits
    });
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
  getCustomers,
  receivePayment,
  createCustomer,
  updateCustomer,
  deleteCustomers
};
