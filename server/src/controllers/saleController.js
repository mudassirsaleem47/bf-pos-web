const prisma = require('../../lib/prisma');

// Generate receipt number
const generateReceiptNo = async () => {
  const count = await prisma.saleTransaction.count();
  return `R-${String(count + 1).padStart(4, '0')}`;
};

// @desc  Get all sales
// @route GET /api/sales
const getSales = async (req, res) => {
  try {
    const sales = await prisma.saleTransaction.findMany({
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
    const { items, totalAmount, paidAmount, discount, tax, customerId } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items are required' });
    }

    const receiptNo = await generateReceiptNo();
    const total = parseFloat(totalAmount) || 0;
    const paid = parseFloat(paidAmount) || 0;
    const change = paid - total > 0 ? paid - total : 0;

    // Credit sale validation: requires a customer
    if (paid < total && !customerId) {
      return res.status(400).json({ message: 'Customer is required for credit transactions.' });
    }

    // 1. Create Sale Transaction
    const sale = await prisma.saleTransaction.create({
      data: {
        receiptNo,
        totalAmount: total,
        paidAmount: paid,
        change,
        discount: parseFloat(discount) || 0,
        tax: parseFloat(tax) || 0,
        customerId: customerId || null,
        items: {
          create: items.map(item => ({
            productId: item.productId || null,
            name: item.name,
            barcode: item.barcode || null,
            quantity: parseFloat(item.quantity),
            price: parseFloat(item.price),
            total: parseFloat(item.total),
          }))
        }
      },
      include: { items: true, customer: true }
    });

    // 2. Adjust Product Stock
    for (const item of items) {
      if (item.productId) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: parseFloat(item.quantity)
            }
          }
        });
      }
    }

    // 3. Update Customer balance if it is a credit sale
    if (customerId && total > paid) {
      const creditAmount = total - paid;
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          balance: {
            increment: creditAmount
          }
        }
      });
    }

    return res.status(201).json(sale);
  } catch (error) {
    console.error('Create sale error:', error);
    return res.status(500).json({ message: 'Server error creating sale' });
  }
};

// @desc  Bulk delete sales
// @route DELETE /api/sales
const deleteSales = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Sale IDs are required' });
    }
    await prisma.saleTransaction.deleteMany({ where: { id: { in: ids } } });
    return res.status(200).json({ message: 'Sales deleted successfully' });
  } catch (error) {
    console.error('Delete sales error:', error);
    return res.status(500).json({ message: 'Server error deleting sales' });
  }
};

module.exports = { getSales, createSale, deleteSales };
