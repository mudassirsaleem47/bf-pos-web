const prisma = require('../../lib/prisma');

// @desc  Get all customers
// @route GET /api/customers
const getCustomers = async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { name: 'asc' },
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
          include: { items: true }
        }
      }
    });
    return res.status(200).json(customers);
  } catch (error) {
    console.error('Get customers error:', error);
    return res.status(500).json({ message: 'Server error fetching customers' });
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
        balance: parseFloat(balance) || 0
      },
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
          include: { items: true }
        }
      }
    });

    return res.status(201).json(customer);
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

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        phone: phone !== undefined ? phone : existing.phone,
        email: email !== undefined ? email : existing.email,
        address: address !== undefined ? address : existing.address,
        loyaltyPoints: loyaltyPoints !== undefined ? parseInt(loyaltyPoints) : existing.loyaltyPoints,
        balance: balance !== undefined ? parseFloat(balance) : existing.balance
      },
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
          include: { items: true }
        }
      }
    });

    return res.status(200).json(customer);
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
      where: { id: { in: ids } }
    });

    return res.status(200).json({ message: 'Customer(s) deleted successfully' });
  } catch (error) {
    console.error('Delete customers error:', error);
    return res.status(500).json({ message: 'Server error deleting customers' });
  }
};

module.exports = {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomers
};
