const prisma = require('../../lib/prisma');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Private
const getCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    return res.status(500).json({ message: 'Server error fetching categories' });
  }
};

// @desc    Create a new category
// @route   POST /api/categories
// @access  Private
const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const newCategory = await prisma.category.create({
      data: {
        name,
        description: description || null,
        userId: req.user.id
      }
    });

    return res.status(201).json(newCategory);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Category name already exists' });
    }
    console.error('Create category error:', error);
    return res.status(500).json({ message: 'Server error creating category' });
  }
};

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Private
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const existing = await prisma.category.findFirst({
      where: { id, userId: req.user.id }
    });
    if (!existing) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const updated = await prisma.category.update({
      where: { id },
      data: { name, description: description || null }
    });

    return res.status(200).json(updated);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Category name already exists' });
    }
    console.error('Update category error:', error);
    return res.status(500).json({ message: 'Server error updating category' });
  }
};

// @desc    Delete categories (bulk)
// @route   DELETE /api/categories
// @access  Private
const deleteCategories = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Category IDs are required' });
    }

    await prisma.category.deleteMany({
      where: {
        id: { in: ids },
        userId: req.user.id
      }
    });

    return res.status(200).json({ message: 'Categories deleted successfully' });
  } catch (error) {
    console.error('Delete categories error:', error);
    return res.status(500).json({ message: 'Server error deleting categories' });
  }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategories };
