const prisma = require('../../lib/prisma');

// @desc  Get all loans
// @route GET /api/loans
const getLoans = async (req, res) => {
  try {
    const loans = await prisma.loan.findMany({
      where: { userId: req.user.id },
      orderBy: { dueDate: 'asc' }
    });
    return res.status(200).json(loans);
  } catch (error) {
    console.error('Get loans error:', error);
    return res.status(500).json({ message: 'Server error fetching loans' });
  }
};

// @desc  Create a loan record
// @route POST /api/loans
const createLoan = async (req, res) => {
  try {
    const { partnerName, type, amount, interestRate, dueDate, status, description } = req.body;
    if (!partnerName || !type || amount === undefined) {
      return res.status(400).json({ message: 'Partner Name, Type, and Amount are required' });
    }

    const loan = await prisma.loan.create({
      data: {
        partnerName,
        type,
        amount: parseFloat(amount) || 0,
        interestRate: parseFloat(interestRate) || 0,
        dueDate: dueDate ? new Date(dueDate) : new Date(),
        status: status || 'Active',
        description: description || null,
        userId: req.user.id
      }
    });

    return res.status(201).json(loan);
  } catch (error) {
    console.error('Create loan error:', error);
    return res.status(500).json({ message: 'Server error creating loan' });
  }
};

// @desc  Update a loan record
// @route PUT /api/loans/:id
const updateLoan = async (req, res) => {
  try {
    const { id } = req.params;
    const { partnerName, type, amount, interestRate, dueDate, status, description } = req.body;

    const existing = await prisma.loan.findFirst({
      where: { id, userId: req.user.id }
    });
    if (!existing) {
      return res.status(404).json({ message: 'Loan record not found' });
    }

    const loan = await prisma.loan.update({
      where: { id },
      data: {
        partnerName: partnerName !== undefined ? partnerName : existing.partnerName,
        type: type !== undefined ? type : existing.type,
        amount: amount !== undefined ? parseFloat(amount) : existing.amount,
        interestRate: interestRate !== undefined ? parseFloat(interestRate) : existing.interestRate,
        dueDate: dueDate !== undefined ? new Date(dueDate) : existing.dueDate,
        status: status !== undefined ? status : existing.status,
        description: description !== undefined ? description : existing.description
      }
    });

    return res.status(200).json(loan);
  } catch (error) {
    console.error('Update loan error:', error);
    return res.status(500).json({ message: 'Server error updating loan' });
  }
};

// @desc  Bulk delete loans
// @route DELETE /api/loans
const deleteLoans = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Loan IDs are required' });
    }

    await prisma.loan.deleteMany({
      where: { id: { in: ids }, userId: req.user.id }
    });

    return res.status(200).json({ message: 'Loan record(s) deleted successfully' });
  } catch (error) {
    console.error('Delete loans error:', error);
    return res.status(500).json({ message: 'Server error deleting loans' });
  }
};

module.exports = {
  getLoans,
  createLoan,
  updateLoan,
  deleteLoans
};
