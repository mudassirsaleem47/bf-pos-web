const prisma = require('../../lib/prisma');
const path = require('path');
const fs = require('fs');

// Generate unique invoice number scoped to user
const generateInvoiceNo = async (userId) => {
  const count = await prisma.supplierInvoice.count({
    where: { userId }
  });
  return `SINV-${String(count + 1).padStart(4, '0')}`;
};

// @desc  Get all supplier invoices
// @route GET /api/supplier-invoices
const getInvoices = async (req, res) => {
  try {
    const invoices = await prisma.supplierInvoice.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        items: true,
      }
    });
    return res.status(200).json(invoices);
  } catch (error) {
    console.error('Get invoices error:', error);
    return res.status(500).json({ message: 'Server error fetching invoices' });
  }
};

// @desc  Get single invoice
// @route GET /api/supplier-invoices/:id
const getInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.supplierInvoice.findFirst({
      where: { id, userId: req.user.id },
      include: {
        supplier: true,
        warehouse: true,
        items: true,
      }
    });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    return res.status(200).json(invoice);
  } catch (error) {
    console.error('Get invoice error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Create supplier invoice
// @route POST /api/supplier-invoices
const createInvoice = async (req, res) => {
  try {
    const { supplierId, warehouseId, date, paidAmount, items } = req.body;

    if (!supplierId || !warehouseId || !date) {
      return res.status(400).json({ message: 'Supplier, Warehouse, and Date are required' });
    }

    // Verify supplier and warehouse belong to user
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, userId: req.user.id }
    });
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, userId: req.user.id }
    });
    if (!supplier || !warehouse) {
      return res.status(400).json({ message: 'Supplier or Warehouse not found or unauthorized' });
    }

    const parsedItems = items ? JSON.parse(items) : [];
    if (parsedItems.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    const grandTotal = parsedItems.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
    const paid = parseFloat(paidAmount) || 0;
    const due = grandTotal - paid;
    const invoiceNo = await generateInvoiceNo(req.user.id);
    const imagePath = req.file ? `uploads/supplier-invoices/${req.file.filename}` : null;

    const invoice = await prisma.supplierInvoice.create({
      data: {
        invoiceNo,
        supplierId,
        warehouseId,
        date: new Date(date),
        imagePath,
        grandTotal,
        paidAmount: paid,
        due,
        userId: req.user.id,
        items: {
          create: parsedItems.map(item => ({
            itemName: item.itemName,
            quantity: parseFloat(item.quantity) || 0,
            rate: parseFloat(item.rate) || 0,
            total: parseFloat(item.total) || 0,
          }))
        }
      },
      include: { supplier: true, warehouse: true, items: true }
    });

    return res.status(201).json(invoice);
  } catch (error) {
    console.error('Create invoice error:', error);
    return res.status(500).json({ message: 'Server error creating invoice' });
  }
};

// @desc  Update supplier invoice
// @route PUT /api/supplier-invoices/:id
const updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { supplierId, warehouseId, date, paidAmount, items } = req.body;

    const existing = await prisma.supplierInvoice.findFirst({
      where: { id, userId: req.user.id }
    });
    if (!existing) return res.status(404).json({ message: 'Invoice not found' });

    // Verify supplier and warehouse belong to user if updated
    if (supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, userId: req.user.id }
      });
      if (!supplier) return res.status(400).json({ message: 'Supplier not found or unauthorized' });
    }
    if (warehouseId) {
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: warehouseId, userId: req.user.id }
      });
      if (!warehouse) return res.status(400).json({ message: 'Warehouse not found or unauthorized' });
    }

    const parsedItems = items ? JSON.parse(items) : [];
    const grandTotal = parsedItems.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
    const paid = parseFloat(paidAmount) || 0;
    const due = grandTotal - paid;

    let imagePath = existing.imagePath;
    if (req.file) {
      // Delete old image if exists
      if (existing.imagePath) {
        const oldPath = path.join(__dirname, '../../', existing.imagePath);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      imagePath = `uploads/supplier-invoices/${req.file.filename}`;
    }

    // Delete old items and recreate
    await prisma.supplierInvoiceItem.deleteMany({
      where: {
        invoiceId: id,
        invoice: { userId: req.user.id }
      }
    });

    const updated = await prisma.supplierInvoice.update({
      where: { id },
      data: {
        supplierId,
        warehouseId,
        date: new Date(date),
        imagePath,
        grandTotal,
        paidAmount: paid,
        due,
        items: {
          create: parsedItems.map(item => ({
            itemName: item.itemName,
            quantity: parseFloat(item.quantity) || 0,
            rate: parseFloat(item.rate) || 0,
            total: parseFloat(item.total) || 0,
          }))
        }
      },
      include: { supplier: true, warehouse: true, items: true }
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Update invoice error:', error);
    return res.status(500).json({ message: 'Server error updating invoice' });
  }
};

// @desc  Bulk delete invoices
// @route DELETE /api/supplier-invoices
const deleteInvoices = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Invoice IDs are required' });
    }

    // Delete images, scoped to user
    const invoices = await prisma.supplierInvoice.findMany({
      where: { id: { in: ids }, userId: req.user.id }
    });
    invoices.forEach(inv => {
      if (inv.imagePath) {
        const imgPath = path.join(__dirname, '../../', inv.imagePath);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      }
    });

    await prisma.supplierInvoice.deleteMany({
      where: { id: { in: ids }, userId: req.user.id }
    });
    return res.status(200).json({ message: 'Invoices deleted successfully' });
  } catch (error) {
    console.error('Delete invoices error:', error);
    return res.status(500).json({ message: 'Server error deleting invoices' });
  }
};

module.exports = { getInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoices };
