const prisma = require('../../lib/prisma');

// @desc    Get all warehouses
// @route   GET /api/warehouses
// @access  Private
const getWarehouses = async (req, res) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json(warehouses);
  } catch (error) {
    console.error('Get warehouses error:', error);
    return res.status(500).json({ message: 'Server error fetching warehouses' });
  }
};

// @desc    Create a warehouse
// @route   POST /api/warehouses
// @access  Private
const createWarehouse = async (req, res) => {
  try {
    const { name, location, capacity, manager, phone } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Warehouse name is required' });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name,
        location: location || null,
        capacity: capacity ? parseInt(capacity) : null,
        manager: manager || null,
        phone: phone || null,
        userId: req.user.id
      }
    });

    return res.status(201).json(warehouse);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Warehouse name already exists' });
    }
    console.error('Create warehouse error:', error);
    return res.status(500).json({ message: 'Server error creating warehouse' });
  }
};

// @desc    Update a warehouse
// @route   PUT /api/warehouses/:id
// @access  Private
const updateWarehouse = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, capacity, manager, phone } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Warehouse name is required' });
    }

    const existing = await prisma.warehouse.findFirst({
      where: { id, userId: req.user.id }
    });
    if (!existing) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }

    const updated = await prisma.warehouse.update({
      where: { id },
      data: {
        name,
        location: location || null,
        capacity: capacity ? parseInt(capacity) : null,
        manager: manager || null,
        phone: phone || null,
      }
    });

    return res.status(200).json(updated);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Warehouse name already exists' });
    }
    console.error('Update warehouse error:', error);
    return res.status(500).json({ message: 'Server error updating warehouse' });
  }
};

// @desc    Delete warehouses (bulk)
// @route   DELETE /api/warehouses
// @access  Private
const deleteWarehouses = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Warehouse IDs are required' });
    }

    await prisma.warehouse.deleteMany({
      where: {
        id: { in: ids },
        userId: req.user.id
      }
    });

    return res.status(200).json({ message: 'Warehouses deleted successfully' });
  } catch (error) {
    console.error('Delete warehouses error:', error);
    return res.status(500).json({ message: 'Server error deleting warehouses' });
  }
};

module.exports = { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouses };
