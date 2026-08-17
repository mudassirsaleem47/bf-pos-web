const prisma = require('../../lib/prisma');
const path = require('path');
const fs = require('fs');

// @desc  Get all products
// @route GET /api/products
const getProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { category: { select: { id: true, name: true } } }
    });
    return res.status(200).json(products);
  } catch (error) {
    console.error('Get products error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get product by barcode
// @route GET /api/products/barcode/:barcode
const getProductByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;
    const product = await prisma.product.findFirst({
      where: { barcode, userId: req.user.id },
      include: { category: { select: { name: true } } }
    });
    if (!product) return res.status(404).json({ message: 'Product not found for this barcode' });
    return res.status(200).json(product);
  } catch (error) {
    console.error('Get product by barcode error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Create product
// @route POST /api/products
const createProduct = async (req, res) => {
  try {
    const {
      name,
      barcode,
      price,
      stock,
      unit,
      categoryId,
      expiryDate,
      warehouseId,
      rackNo,
      detail,
      mfgDate,
      lowStockAlert,
      supplierPrice,
      model,
      supplierId,
      isDamaged,
      damagedReason
    } = req.body;

    if (!name || !barcode) {
      return res.status(400).json({ message: 'Name and barcode are required' });
    }

    const imagePath = req.file ? `uploads/products/${req.file.filename}` : null;

    const product = await prisma.product.create({
      data: {
        name,
        barcode,
        price: parseFloat(price) || 0,
        stock: parseFloat(stock) || 0,
        unit: unit || 'pcs',
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        categoryId: categoryId || null,
        warehouseId: warehouseId || null,
        rackNo: rackNo || null,
        imagePath,
        detail: detail || null,
        mfgDate: mfgDate ? new Date(mfgDate) : null,
        lowStockAlert: lowStockAlert ? parseFloat(lowStockAlert) : 5,
        supplierPrice: supplierPrice ? parseFloat(supplierPrice) : 0,
        model: model || null,
        supplierId: supplierId || null,
        isDamaged: isDamaged === 'true' || isDamaged === true,
        damagedReason: damagedReason || null,
        userId: req.user.id
      },
      include: {
        category: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } }
      }
    });
    return res.status(201).json(product);
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ message: 'Barcode already exists' });
    console.error('Create product error:', error);
    return res.status(500).json({ message: 'Server error creating product' });
  }
};

// @desc  Update product
// @route PUT /api/products/:id
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      barcode,
      price,
      stock,
      unit,
      categoryId,
      expiryDate,
      warehouseId,
      rackNo,
      detail,
      mfgDate,
      lowStockAlert,
      supplierPrice,
      model,
      supplierId,
      isDamaged,
      damagedReason
    } = req.body;

    const existing = await prisma.product.findFirst({
      where: { id, userId: req.user.id }
    });
    if (!existing) return res.status(404).json({ message: 'Product not found' });

    let imagePath = existing.imagePath;
    if (req.file) {
      // Delete old image if exists
      if (existing.imagePath) {
        const oldPath = path.join(__dirname, '../../', existing.imagePath);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      imagePath = `uploads/products/${req.file.filename}`;
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        barcode,
        price: parseFloat(price) || 0,
        stock: parseFloat(stock) || 0,
        unit: unit || 'pcs',
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        categoryId: categoryId || null,
        warehouseId: warehouseId || null,
        rackNo: rackNo || null,
        imagePath,
        detail: detail || null,
        mfgDate: mfgDate ? new Date(mfgDate) : null,
        lowStockAlert: lowStockAlert ? parseFloat(lowStockAlert) : 5,
        supplierPrice: supplierPrice ? parseFloat(supplierPrice) : 0,
        model: model || null,
        supplierId: supplierId || null,
        isDamaged: isDamaged !== undefined ? (isDamaged === 'true' || isDamaged === true) : existing.isDamaged,
        damagedReason: damagedReason !== undefined ? damagedReason : existing.damagedReason,
      },
      include: {
        category: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } }
      }
    });
    return res.status(200).json(product);
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ message: 'Barcode already exists' });
    console.error('Update product error:', error);
    return res.status(500).json({ message: 'Server error updating product' });
  }
};

// @desc  Bulk delete products
// @route DELETE /api/products
const deleteProducts = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Product IDs are required' });
    }

    // Find products to delete their images, scoped to user
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, userId: req.user.id }
    });

    products.forEach(p => {
      if (p.imagePath) {
        const imgPath = path.join(__dirname, '../../', p.imagePath);
        if (fs.existsSync(imgPath)) {
          fs.unlinkSync(imgPath);
        }
      }
    });

    await prisma.product.deleteMany({
      where: { id: { in: ids }, userId: req.user.id }
    });
    return res.status(200).json({ message: 'Products deleted successfully' });
  } catch (error) {
    console.error('Delete products error:', error);
    return res.status(500).json({ message: 'Server error deleting products' });
  }
};

// @desc  Get product by ID
// @route GET /api/products/:id
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findFirst({
      where: { id, userId: req.user.id },
      include: {
        category: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        saleItems: {
          include: {
            sale: {
              include: {
                customer: { select: { id: true, name: true, phone: true } }
              }
            }
          }
        }
      }
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    return res.status(200).json(product);
  } catch (error) {
    console.error('Get product by ID error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Bulk import products
// @route POST /api/products/import
const importProducts = async (req, res) => {
  try {
    const { products } = req.body;
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ message: 'Invalid products list' });
    }

    let successCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (let i = 0; i < products.length; i++) {
      const item = products[i];
      try {
        if (!item.name || !item.name.trim()) {
          skippedCount++;
          errors.push(`Row ${i + 1}: Name is required`);
          continue;
        }

        const priceVal = parseFloat(item.price);
        if (isNaN(priceVal)) {
          skippedCount++;
          errors.push(`Row ${i + 1} (${item.name}): Sell Price is required`);
          continue;
        }

        // Handle barcode scoped to user
        let barcodeVal = item.barcode ? String(item.barcode).trim() : '';
        if (!barcodeVal) {
          // Auto-generate barcode
          let isUnique = false;
          let generated = '';
          let limit = 0;
          while (!isUnique && limit < 10) {
            generated = '890' + Math.floor(100000000 + Math.random() * 900000000);
            const check = await prisma.product.findFirst({
              where: { barcode: generated, userId: req.user.id }
            });
            if (!check) isUnique = true;
            limit++;
          }
          barcodeVal = generated;
        } else {
          // Check uniqueness of provided barcode scoped to user
          const check = await prisma.product.findFirst({
            where: { barcode: barcodeVal, userId: req.user.id }
          });
          if (check) {
            skippedCount++;
            errors.push(`Row ${i + 1} (${item.name}): Barcode ${barcodeVal} already exists`);
            continue;
          }
        }

        // Create product
        await prisma.product.create({
          data: {
            name: item.name.trim(),
            barcode: barcodeVal,
            price: priceVal,
            stock: parseFloat(item.stock) || 0,
            unit: item.unit ? String(item.unit).trim() : 'pcs',
            expiryDate: item.expiryDate && !isNaN(Date.parse(item.expiryDate)) ? new Date(item.expiryDate) : null,
            rackNo: item.rackNo ? String(item.rackNo).trim() : null,
            detail: item.detail ? String(item.detail).trim() : null,
            mfgDate: item.mfgDate && !isNaN(Date.parse(item.mfgDate)) ? new Date(item.mfgDate) : null,
            lowStockAlert: item.lowStockAlert ? parseFloat(item.lowStockAlert) : 5,
            supplierPrice: item.supplierPrice ? parseFloat(item.supplierPrice) : 0,
            model: item.model ? String(item.model).trim() : null,
            userId: req.user.id
          }
        });
        successCount++;
      } catch (err) {
        console.error(`Error importing row ${i + 1}:`, err);
        skippedCount++;
        errors.push(`Row ${i + 1} (${item.name || 'Unknown'}): ${err.message || 'Database error'}`);
      }
    }

    return res.status(200).json({
      message: 'Bulk import complete',
      successCount,
      skippedCount,
      errors
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return res.status(500).json({ message: 'Server error during import' });
  }
};

module.exports = { getProducts, getProductByBarcode, createProduct, updateProduct, deleteProducts, getProductById, importProducts };
