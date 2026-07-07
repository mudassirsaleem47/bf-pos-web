const prisma = require('../../lib/prisma');

// @desc  Get all staff members
// @route GET /api/staff
const getStaff = async (req, res) => {
  try {
    const staff = await prisma.staff.findMany({
      where: { userId: req.user.id },
      orderBy: { name: 'asc' }
    });
    return res.status(200).json(staff);
  } catch (error) {
    console.error('Get staff error:', error);
    return res.status(500).json({ message: 'Server error fetching staff' });
  }
};

// @desc  Create a staff employee profile
// @route POST /api/staff
const createStaff = async (req, res) => {
  try {
    const { name, email, phone, role, salary, dateHired, status } = req.body;
    if (!name || !role || salary === undefined) {
      return res.status(400).json({ message: 'Name, Role, and Salary are required' });
    }

    const employee = await prisma.staff.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        role,
        salary: parseFloat(salary) || 0,
        dateHired: dateHired ? new Date(dateHired) : new Date(),
        status: status || 'Active',
        userId: req.user.id
      }
    });

    return res.status(201).json(employee);
  } catch (error) {
    console.error('Create staff error:', error);
    return res.status(500).json({ message: 'Server error creating staff employee' });
  }
};

// @desc  Update a staff employee profile
// @route PUT /api/staff/:id
const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, salary, dateHired, status } = req.body;

    const existing = await prisma.staff.findFirst({
      where: { id, userId: req.user.id }
    });
    if (!existing) {
      return res.status(404).json({ message: 'Staff profile not found' });
    }

    const employee = await prisma.staff.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        email: email !== undefined ? email : existing.email,
        phone: phone !== undefined ? phone : existing.phone,
        role: role !== undefined ? role : existing.role,
        salary: salary !== undefined ? parseFloat(salary) : existing.salary,
        dateHired: dateHired !== undefined ? new Date(dateHired) : existing.dateHired,
        status: status !== undefined ? status : existing.status
      }
    });

    return res.status(200).json(employee);
  } catch (error) {
    console.error('Update staff error:', error);
    return res.status(500).json({ message: 'Server error updating staff employee' });
  }
};

// @desc  Bulk delete staff profiles
// @route DELETE /api/staff
const deleteStaff = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Staff IDs are required' });
    }

    await prisma.staff.deleteMany({
      where: { id: { in: ids }, userId: req.user.id }
    });

    return res.status(200).json({ message: 'Staff profile(s) deleted successfully' });
  } catch (error) {
    console.error('Delete staff error:', error);
    return res.status(500).json({ message: 'Server error deleting staff profiles' });
  }
};

module.exports = {
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff
};
