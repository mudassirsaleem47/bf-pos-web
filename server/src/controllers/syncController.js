const prisma = require('../../lib/prisma');

// @desc    Push local changes to cloud database (Web Server)
// @route   POST /api/sync/push
// @access  Private
const pushChanges = async (req, res) => {
  const { logs, data } = req.body;
  const userId = req.user.id;

  if (!logs || !Array.isArray(logs)) {
    return res.status(400).json({ message: 'Invalid sync logs' });
  }

  try {
    // Process sync logs in transaction or sequentially
    for (const log of logs) {
      const { modelName, recordId, action } = log;
      const recordData = data[modelName] && data[modelName].find(r => r.id === recordId);

      if (action === 'delete') {
        try {
          if (modelName === 'Product') {
            await prisma.product.delete({ where: { id: recordId } });
          } else if (modelName === 'Category') {
            await prisma.category.delete({ where: { id: recordId } });
          } else if (modelName === 'Warehouse') {
            await prisma.warehouse.delete({ where: { id: recordId } });
          } else if (modelName === 'Supplier') {
            await prisma.supplier.delete({ where: { id: recordId } });
          } else if (modelName === 'Customer') {
            await prisma.customer.delete({ where: { id: recordId } });
          } else if (modelName === 'SaleTransaction') {
            await prisma.saleTransaction.delete({ where: { id: recordId } });
          } else if (modelName === 'SupplierInvoice') {
            await prisma.supplierInvoice.delete({ where: { id: recordId } });
          } else if (modelName === 'Expense') {
            await prisma.expense.delete({ where: { id: recordId } });
          } else if (modelName === 'Loan') {
            await prisma.loan.delete({ where: { id: recordId } });
          } else if (modelName === 'Staff') {
            await prisma.staff.delete({ where: { id: recordId } });
          }
        } catch (err) {
          // Record might already be deleted on cloud, which is fine
          console.warn(`Record ${recordId} in ${modelName} already deleted or not found.`);
        }
      } else if (action === 'create' || action === 'update') {
        if (!recordData) continue;

        // Strip relations fields and ensure userId is set
        const { category, supplier, warehouse, customer, items, ...cleanData } = recordData;
        cleanData.userId = userId;

        // Handle nested creations or specific date conversions
        if (cleanData.createdAt) cleanData.createdAt = new Date(cleanData.createdAt);
        if (cleanData.updatedAt) cleanData.updatedAt = new Date(cleanData.updatedAt);
        if (cleanData.expiryDate) cleanData.expiryDate = new Date(cleanData.expiryDate);
        if (cleanData.mfgDate) cleanData.mfgDate = new Date(cleanData.mfgDate);
        if (cleanData.date) cleanData.date = new Date(cleanData.date);
        if (cleanData.dueDate) cleanData.dueDate = new Date(cleanData.dueDate);
        if (cleanData.dateHired) cleanData.dateHired = new Date(cleanData.dateHired);

        if (modelName === 'Product') {
          await prisma.product.upsert({
            where: { id: recordId },
            create: cleanData,
            update: cleanData
          });
        } else if (modelName === 'Category') {
          await prisma.category.upsert({
            where: { id: recordId },
            create: cleanData,
            update: cleanData
          });
        } else if (modelName === 'Warehouse') {
          await prisma.warehouse.upsert({
            where: { id: recordId },
            create: cleanData,
            update: cleanData
          });
        } else if (modelName === 'Supplier') {
          await prisma.supplier.upsert({
            where: { id: recordId },
            create: cleanData,
            update: cleanData
          });
        } else if (modelName === 'Customer') {
          await prisma.customer.upsert({
            where: { id: recordId },
            create: cleanData,
            update: cleanData
          });
        } else if (modelName === 'Expense') {
          await prisma.expense.upsert({
            where: { id: recordId },
            create: cleanData,
            update: cleanData
          });
        } else if (modelName === 'Loan') {
          await prisma.loan.upsert({
            where: { id: recordId },
            create: cleanData,
            update: cleanData
          });
        } else if (modelName === 'Staff') {
          await prisma.staff.upsert({
            where: { id: recordId },
            create: cleanData,
            update: cleanData
          });
        } else if (modelName === 'SaleTransaction') {
          // Delete existing nested items first
          await prisma.saleItem.deleteMany({ where: { saleId: recordId } });
          
          // Re-create transaction and items
          const itemsData = items ? items.map(it => ({
            id: it.id,
            productId: it.productId,
            name: it.name,
            barcode: it.barcode,
            quantity: parseFloat(it.quantity),
            price: parseFloat(it.price),
            total: parseFloat(it.total)
          })) : [];

          await prisma.saleTransaction.upsert({
            where: { id: recordId },
            create: {
              ...cleanData,
              items: { create: itemsData }
            },
            update: {
              ...cleanData,
              items: { create: itemsData }
            }
          });
        } else if (modelName === 'SupplierInvoice') {
          await prisma.supplierInvoiceItem.deleteMany({ where: { invoiceId: recordId } });

          const itemsData = items ? items.map(it => ({
            id: it.id,
            itemName: it.itemName,
            quantity: parseFloat(it.quantity),
            rate: parseFloat(it.rate),
            total: parseFloat(it.total)
          })) : [];

          await prisma.supplierInvoice.upsert({
            where: { id: recordId },
            create: {
              ...cleanData,
              items: { create: itemsData }
            },
            update: {
              ...cleanData,
              items: { create: itemsData }
            }
          });
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Push changes error:', error);
    return res.status(500).json({ message: 'Server error applying synced data' });
  }
};

// @desc    Pull remote changes from cloud database (Web Server)
// @route   GET /api/sync/pull
// @access  Private
const pullChanges = async (req, res) => {
  const { since } = req.query;
  const userId = req.user.id;
  const sinceDate = since ? new Date(parseInt(since) || since) : new Date(0);

  try {
    // 1. Fetch all records updated since `sinceDate`
    const [products, categories, warehouses, suppliers, customers, sales, invoices, expenses, loans, staff] = await Promise.all([
      prisma.product.findMany({ where: { userId, updatedAt: { gt: sinceDate } } }),
      prisma.category.findMany({ where: { userId, updatedAt: { gt: sinceDate } } }),
      prisma.warehouse.findMany({ where: { userId, updatedAt: { gt: sinceDate } } }),
      prisma.supplier.findMany({ where: { userId, updatedAt: { gt: sinceDate } } }),
      prisma.customer.findMany({ where: { userId, updatedAt: { gt: sinceDate } } }),
      prisma.saleTransaction.findMany({ where: { userId, updatedAt: { gt: sinceDate } }, include: { items: true } }),
      prisma.supplierInvoice.findMany({ where: { userId, updatedAt: { gt: sinceDate } }, include: { items: true } }),
      prisma.expense.findMany({ where: { userId, updatedAt: { gt: sinceDate } } }),
      prisma.loan.findMany({ where: { userId, updatedAt: { gt: sinceDate } } }),
      prisma.staff.findMany({ where: { userId, updatedAt: { gt: sinceDate } } })
    ]);

    // 2. Fetch deletions logged in SyncLog since `sinceDate`
    const deletions = await prisma.syncLog.findMany({
      where: {
        userId,
        action: 'delete',
        createdAt: { gt: sinceDate }
      }
    });

    return res.status(200).json({
      updates: {
        Product: products,
        Category: categories,
        Warehouse: warehouses,
        Supplier: suppliers,
        Customer: customers,
        SaleTransaction: sales,
        SupplierInvoice: invoices,
        Expense: expenses,
        Loan: loans,
        Staff: staff
      },
      deletions,
      serverTime: Date.now()
    });
  } catch (error) {
    console.error('Pull changes error:', error);
    return res.status(500).json({ message: 'Server error fetching pulled data' });
  }
};

module.exports = { pushChanges, pullChanges };
