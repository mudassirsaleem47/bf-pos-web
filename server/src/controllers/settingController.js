const prisma = require('../../lib/prisma');
const path = require('path');
const fs = require('fs');

// @desc  Get store settings
// @route GET /api/settings
const getSettings = async (req, res) => {
  try {
    let settings = await prisma.setting.findUnique({ where: { userId: req.user.id } });
    if (!settings) {
      settings = await prisma.setting.create({ data: { userId: req.user.id } });
    }
    return res.status(200).json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    return res.status(500).json({ message: 'Server error fetching settings' });
  }
};

// @desc  Update store settings
// @route PUT /api/settings
const updateSettings = async (req, res) => {
  try {
    const { storeName, address, phone, email, website, taxRate, currency, receiptFooter } = req.body;

    let logoPath = undefined;
    if (req.file) {
      const existing = await prisma.setting.findUnique({ where: { userId: req.user.id } });
      if (existing?.logoPath) {
        const oldPath = path.join(__dirname, '../../', existing.logoPath);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      logoPath = `uploads/settings/${req.file.filename}`;
    }

    const updateData = {};
    if (storeName !== undefined) updateData.storeName = storeName;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (website !== undefined) updateData.website = website;
    if (taxRate !== undefined) updateData.taxRate = parseFloat(taxRate) || 0;
    if (currency !== undefined) updateData.currency = currency;
    if (receiptFooter !== undefined) updateData.receiptFooter = receiptFooter;
    if (logoPath !== undefined) updateData.logoPath = logoPath;

    const settings = await prisma.setting.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, storeName: storeName || 'My Store', ...updateData },
      update: updateData,
    });

    return res.status(200).json(settings);
  } catch (error) {
    console.error('Update settings error:', error);
    return res.status(500).json({ message: 'Server error updating settings' });
  }
};

// @desc  Clear all store transactional and master data
// @route DELETE /api/settings/clear-data
const clearData = async (req, res) => {
  try {
    // Delete in dependency order to prevent foreign key violations, scoped to the user
    await prisma.$transaction([
      prisma.saleItem.deleteMany({
        where: { sale: { userId: req.user.id } }
      }),
      prisma.saleTransaction.deleteMany({
        where: { userId: req.user.id }
      }),
      prisma.supplierInvoiceItem.deleteMany({
        where: { invoice: { userId: req.user.id } }
      }),
      prisma.supplierInvoice.deleteMany({
        where: { userId: req.user.id }
      }),
      prisma.product.deleteMany({
        where: { userId: req.user.id }
      }),
      prisma.category.deleteMany({
        where: { userId: req.user.id }
      }),
      prisma.supplier.deleteMany({
        where: { userId: req.user.id }
      }),
      prisma.customer.deleteMany({
        where: { userId: req.user.id }
      }),
      prisma.expense.deleteMany({
        where: { userId: req.user.id }
      }),
      prisma.loan.deleteMany({
        where: { userId: req.user.id }
      }),
      prisma.staff.deleteMany({
        where: { userId: req.user.id }
      }),
      prisma.warehouse.deleteMany({
        where: { userId: req.user.id }
      }),
    ]);

    return res.status(200).json({ message: 'All store data cleared successfully' });
  } catch (error) {
    console.error('Clear data error:', error);
    return res.status(500).json({ message: 'Server error clearing data' });
  }
};

module.exports = { getSettings, updateSettings, clearData };
