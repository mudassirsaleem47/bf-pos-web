const prisma = require('../../lib/prisma');

// @desc    Get all suppliers
// @route   GET /api/suppliers
// @access  Private
const getSuppliers = async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: {
        userId: req.user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    return res.status(200).json(suppliers);
  } catch (error) {
    console.error('Get suppliers error:', error);
    return res.status(500).json({ message: 'Server error fetching suppliers' });
  }
};

// @desc    Create a new supplier
// @route   POST /api/suppliers
// @access  Private
const createSupplier = async (req, res) => {
  try {
    const { name, contactPerson, email, phone, address } = req.body;

    // Validation
    if (!name || !contactPerson) {
      return res.status(400).json({ message: 'Supplier name and Contact Person are required' });
    }

    const newSupplier = await prisma.supplier.create({
      data: {
        name,
        contactPerson,
        email: email || null,
        phone: phone || null,
        address: address || null,
        userId: req.user.id
      }
    });

    return res.status(201).json(newSupplier);
  } catch (error) {
    console.error('Create supplier error:', error);
    return res.status(500).json({ message: 'Server error creating supplier' });
  }
};

// @desc    Delete suppliers (bulk)
// @route   DELETE /api/suppliers
// @access  Private
const deleteSuppliers = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Supplier IDs are required' });
    }

    await prisma.supplier.deleteMany({
      where: {
        id: {
          in: ids
        },
        userId: req.user.id
      }
    });

    return res.status(200).json({ message: 'Suppliers deleted successfully' });
  } catch (error) {
    console.error('Delete suppliers error:', error);
    return res.status(500).json({ message: `Server error deleting suppliers: ${error.message || error}` });
  }
};

// @desc    Update a supplier
// @route   PUT /api/suppliers/:id
// @access  Private
const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contactPerson, email, phone, address } = req.body;

    // Validation
    if (!name || !contactPerson) {
      return res.status(400).json({ message: 'Supplier name and Contact Person are required' });
    }

    // Check if supplier exists and belongs to the user
    const existingSupplier = await prisma.supplier.findFirst({
      where: { id, userId: req.user.id }
    });

    if (!existingSupplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id },
      data: {
        name,
        contactPerson,
        email: email || null,
        phone: phone || null,
        address: address || null
      }
    });

    return res.status(200).json(updatedSupplier);
  } catch (error) {
    console.error('Update supplier error:', error);
    return res.status(500).json({ message: 'Server error updating supplier' });
  }
};

module.exports = {
  getSuppliers,
  createSupplier,
  deleteSuppliers,
  updateSupplier
};
