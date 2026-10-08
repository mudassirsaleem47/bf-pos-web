const prisma = require('../../lib/prisma');

// Generate unique receipt number scoped to the user (handles deleted sales and collisions)
const generateReceiptNo = async (userId) => {
  const lastSales = await prisma.saleTransaction.findMany({
    where: { userId },
    select: { receiptNo: true }
  });

  let maxNum = 0;
  for (const s of lastSales) {
    if (s.receiptNo) {
      const match = s.receiptNo.match(/\d+$/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  let nextNum = maxNum + 1;
  while (true) {
    const candidate = `R-${String(nextNum).padStart(4, '0')}`;
    const exists = await prisma.saleTransaction.findUnique({
      where: {
        userId_receiptNo: {
          userId,
          receiptNo: candidate
        }
      }
    });
    if (!exists) {
      return candidate;
    }
    nextNum++;
  }
};

// @desc  Get all sales
// @route GET /api/sales
const getSales = async (req, res) => {
  try {
    const sales = await prisma.saleTransaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { items: true, customer: true }
    });
    return res.status(200).json(sales);
  } catch (error) {
    console.error('Get sales error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Create a sale (POS checkout)
// @route POST /api/sales
const createSale = async (req, res) => {
  try {
    const { items, totalAmount, paidAmount, discount, tax, shipping, customerId, orderNo, notes } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items are required' });
    }

    const receiptNo = await generateReceiptNo(req.user.id);
    const total = parseFloat(totalAmount) || 0;
    const paid = parseFloat(paidAmount) || 0;
    const change = paid - total > 0 ? paid - total : 0;

    // Credit sale validation: requires a customer
    if (paid < total && !customerId) {
      return res.status(400).json({ message: 'Customer is required for credit transactions.' });
    }

    // Verify products belong to user and check stock availability
    for (const item of items) {
      if (item.productId) {
        const prod = await prisma.product.findFirst({
          where: { id: item.productId, userId: req.user.id }
        });
        if (!prod) {
          return res.status(400).json({ message: `Product not found or unauthorized: ${item.name}` });
        }
        const itemQty = parseFloat(item.quantity) || 0;
        // Only validate positive quantities (sales). Returns have negative quantities.
        if (itemQty > 0) {
          if (prod.stock <= 0) {
            return res.status(400).json({ message: `Product "${prod.name}" is out of stock (Available: 0). Cannot process sale.` });
          }
          if (prod.stock < itemQty) {
            return res.status(400).json({ message: `Insufficient stock for "${prod.name}". Available: ${prod.stock}, Requested: ${itemQty}.` });
          }
        }
      }
    }

    // Verify customer belongs to user if provided
    if (customerId) {
      const cust = await prisma.customer.findFirst({
        where: { id: customerId, userId: req.user.id }
      });
      if (!cust) {
        return res.status(400).json({ message: 'Customer not found or unauthorized.' });
      }
    }

    // Atomic transaction for sale creation, stock decrement, and customer khata update
    const sale = await prisma.$transaction(async (tx) => {
      // 1. Create Sale Transaction
      const newSale = await tx.saleTransaction.create({
        data: {
          receiptNo,
          orderNo: orderNo ? String(orderNo).trim() : null,
          notes: notes ? String(notes).trim() : null,
          totalAmount: total,
          paidAmount: paid,
          change,
          discount: parseFloat(discount) || 0,
          tax: parseFloat(tax) || 0,
          shipping: parseFloat(shipping) || 0,
          customerId: customerId || null,
          userId: req.user.id,
          items: {
            create: items.map(item => ({
              productId: item.productId || null,
              name: item.name,
              barcode: item.barcode || null,
              quantity: parseFloat(item.quantity) || 0,
              price: parseFloat(item.price) || 0,
              discount: parseFloat(item.discount) || 0,
              total: parseFloat(item.total) || 0,
            }))
          }
        },
        include: { items: true, customer: true }
      });

      // 2. Adjust Product Stock
      for (const item of items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                decrement: parseFloat(item.quantity) || 0
              }
            }
          });
        }
      }

      // 3. Update Customer balance if it is a credit sale
      if (customerId && total > paid) {
        const creditAmount = total - paid;
        await tx.customer.update({
          where: { id: customerId },
          data: {
            balance: {
              increment: creditAmount
            }
          }
        });
      }

      return newSale;
    }, { maxWait: 10000, timeout: 20000 });

    return res.status(201).json(sale);
  } catch (error) {
    console.error('Create sale error:', error);
    return res.status(500).json({ message: error.message || 'Server error creating sale' });
  }
};

// @desc  Bulk delete sales (void transactions, restore product stock & adjust customer balances)
// @route DELETE /api/sales
const deleteSales = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Sale IDs are required' });
    }

    // 1. Fetch sales with items to know which products and quantities to restore
    const salesToDelete = await prisma.saleTransaction.findMany({
      where: {
        id: { in: ids },
        userId: req.user.id
      },
      include: {
        items: true
      }
    });

    if (salesToDelete.length === 0) {
      return res.status(404).json({ message: 'No matching sales found to delete' });
    }

    await prisma.$transaction(async (tx) => {
      for (const sale of salesToDelete) {
        // 1. Restore product stock quantities
        for (const item of sale.items) {
          if (item.productId) {
            const product = await tx.product.findFirst({
              where: { id: item.productId, userId: req.user.id }
            });
            if (product) {
              const qty = parseFloat(item.quantity) || 0;
              await tx.product.update({
                where: { id: item.productId },
                data: {
                  stock: {
                    increment: qty
                  }
                }
              });
            }
          }
        }

        // 2. Adjust customer balance if this was a credit sale with unpaid due
        if (sale.customerId) {
          const dueAmount = Math.max(0, (sale.totalAmount || 0) - (sale.paidAmount || 0));
          if (dueAmount > 0.001) {
            const customer = await tx.customer.findFirst({
              where: { id: sale.customerId, userId: req.user.id }
            });
            if (customer) {
              const newBalance = Math.max(0, (customer.balance || 0) - dueAmount);
              await tx.customer.update({
                where: { id: sale.customerId },
                data: { balance: newBalance }
              });
            }
          }
        }

        // 3. Delete the sale transaction (items will cascade delete)
        await tx.saleTransaction.delete({
          where: { id: sale.id }
        });
      }
    }, { maxWait: 10000, timeout: 20000 });

    return res.status(200).json({ 
      message: `${salesToDelete.length} sale transaction(s) deleted and product stock restored successfully.` 
    });
  } catch (error) {
    console.error('Delete sales error:', error);
    return res.status(500).json({ message: 'Server error deleting sales' });
  }
};

module.exports = { getSales, createSale, deleteSales };
