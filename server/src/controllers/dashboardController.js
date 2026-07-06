const prisma = require('../../lib/prisma');

// @desc  Get consolidated dashboard statistics
// @route GET /api/dashboard/stats
const getDashboardStats = async (req, res) => {
  try {
    const [products, sales, categories, suppliers, settings, supplierInvoices, expenses, loans, customers] = await Promise.all([
      prisma.product.findMany({
        include: { category: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.saleTransaction.findMany({
        orderBy: { createdAt: 'desc' },
        include: { items: true }
      }),
      prisma.category.findMany({
        orderBy: { name: 'asc' }
      }),
      prisma.supplier.findMany({
        orderBy: { name: 'asc' }
      }),
      prisma.setting.findUnique({
        where: { id: 'default' }
      }),
      prisma.supplierInvoice.findMany({
        orderBy: { createdAt: 'desc' },
        include: { supplier: true, warehouse: true, items: true }
      }),
      prisma.expense.findMany({
        orderBy: { date: 'desc' }
      }),
      prisma.loan.findMany({
        orderBy: { dueDate: 'asc' }
      }),
      prisma.customer.findMany({
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return res.status(200).json({
      products: products || [],
      sales: sales || [],
      categories: categories || [],
      suppliers: suppliers || [],
      settings: settings || null,
      supplierInvoices: supplierInvoices || [],
      expenses: expenses || [],
      loans: loans || [],
      customers: customers || []
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({ message: 'Server error fetching dashboard stats' });
  }
};

// @desc  Get real-time notification alerts (low stock, expiry, overdue loans)
// @route GET /api/dashboard/notifications
const getNotifications = async (req, res) => {
  try {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const [lowStock, expired, overdueLoans] = await Promise.all([
      // 1. Low stock products (stock <= 5)
      prisma.product.findMany({
        where: { stock: { lte: 5 } },
        select: { id: true, name: true, stock: true, unit: true }
      }),
      // 2. Expired or expiring soon (within 30 days)
      prisma.product.findMany({
        where: {
          expiryDate: {
            not: null,
            lte: thirtyDaysFromNow
          }
        },
        select: { id: true, name: true, expiryDate: true, stock: true }
      }),
      // 3. Overdue loans
      prisma.loan.findMany({
        where: {
          status: 'Overdue'
        },
        select: { id: true, partnerName: true, amount: true, type: true, dueDate: true }
      })
    ]);

    // Format them into a single list of notification objects
    const list = [];

    lowStock.forEach(p => {
      list.push({
        id: `low-stock-${p.id}`,
        type: 'low-stock',
        title: 'Low Stock Alert',
        message: `${p.name} is running low on stock (${p.stock} ${p.unit} remaining).`,
        severity: 'warning',
        date: new Date()
      });
    });

    expired.forEach(p => {
      const isExpired = new Date(p.expiryDate) < today;
      list.push({
        id: `expiry-${p.id}`,
        type: 'expiry',
        title: isExpired ? 'Product Expired' : 'Product Expiring Soon',
        message: isExpired
          ? `${p.name} expired on ${new Date(p.expiryDate).toLocaleDateString()}.`
          : `${p.name} will expire on ${new Date(p.expiryDate).toLocaleDateString()}.`,
        severity: isExpired ? 'error' : 'warning',
        date: p.expiryDate
      });
    });

    overdueLoans.forEach(l => {
      list.push({
        id: `loan-${l.id}`,
        type: 'loan',
        title: 'Overdue (Rec/Pay)',
        message: `${l.type === 'Payable' ? 'Payable to' : 'Receivable from'} ${l.partnerName} of Rs. ${l.amount.toFixed(2)} is overdue.`,
        severity: 'error',
        date: l.dueDate
      });
    });

    // Sort notifications by date (newest/most urgent first)
    list.sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json(list);
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ message: 'Server error fetching notifications' });
  }
};

module.exports = {
  getDashboardStats,
  getNotifications
};
