const prisma = require('../../lib/prisma');

// @desc  Get all expenses
// @route GET /api/expenses
const getExpenses = async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      where: { userId: req.user.id },
      orderBy: { date: 'desc' }
    });
    return res.status(200).json(expenses);
  } catch (error) {
    console.error('Get expenses error:', error);
    return res.status(500).json({ message: 'Server error fetching expenses' });
  }
};

// @desc  Create an expense record
// @route POST /api/expenses
const createExpense = async (req, res) => {
  try {
    const { title, category, amount, date, description } = req.body;
    if (!title || !category || amount === undefined) {
      return res.status(400).json({ message: 'Title, Category, and Amount are required' });
    }

    const expense = await prisma.expense.create({
      data: {
        title,
        category,
        amount: parseFloat(amount) || 0,
        date: date ? new Date(date) : new Date(),
        description: description || null,
        userId: req.user.id
      }
    });

    return res.status(201).json(expense);
  } catch (error) {
    console.error('Create expense error:', error);
    return res.status(500).json({ message: 'Server error creating expense' });
  }
};

// @desc  Update an expense record
// @route PUT /api/expenses/:id
const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, amount, date, description } = req.body;

    const existing = await prisma.expense.findFirst({
      where: { id, userId: req.user.id }
    });
    if (!existing) {
      return res.status(404).json({ message: 'Expense record not found' });
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        title: title !== undefined ? title : existing.title,
        category: category !== undefined ? category : existing.category,
        amount: amount !== undefined ? parseFloat(amount) : existing.amount,
        date: date !== undefined ? new Date(date) : existing.date,
        description: description !== undefined ? description : existing.description
      }
    });

    return res.status(200).json(expense);
  } catch (error) {
    console.error('Update expense error:', error);
    return res.status(500).json({ message: 'Server error updating expense' });
  }
};

// @desc  Bulk delete expenses
// @route DELETE /api/expenses
const deleteExpenses = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Expense IDs are required' });
    }

    await prisma.expense.deleteMany({
      where: { id: { in: ids }, userId: req.user.id }
    });

    return res.status(200).json({ message: 'Expense record(s) deleted successfully' });
  } catch (error) {
    console.error('Delete expenses error:', error);
    return res.status(500).json({ message: 'Server error deleting expenses' });
  }
};

module.exports = {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpenses
};
