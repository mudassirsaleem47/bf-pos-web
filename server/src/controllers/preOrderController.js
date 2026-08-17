const prisma = require('../../lib/prisma');

// Auto-generate Pre-Order number scoped to user (e.g. PO-0001)
const generateOrderNo = async (userId) => {
  const count = await prisma.preOrder.count({
    where: { userId }
  });
  return `PO-${String(count + 1).padStart(4, '0')}`;
};

// @desc  Get all pre-orders
// @route GET /api/pre-orders
const getPreOrders = async (req, res) => {
  try {
    const preOrders = await prisma.preOrder.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        items: {
          include: { product: true }
        }
      }
    });
    return res.status(200).json(preOrders);
  } catch (error) {
    console.error('Get pre-orders error:', error);
    return res.status(500).json({ message: 'Server error fetching pre-orders' });
  }
};

// @desc  Get pre-order by ID
// @route GET /api/pre-orders/:id
const getPreOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const preOrder = await prisma.preOrder.findFirst({
      where: { id, userId: req.user.id },
      include: {
        customer: true,
        items: {
          include: { product: true }
        }
      }
    });

    if (!preOrder) {
      return res.status(404).json({ message: 'Pre-order not found' });
    }

    return res.status(200).json(preOrder);
  } catch (error) {
    console.error('Get pre-order by id error:', error);
    return res.status(500).json({ message: 'Server error fetching pre-order' });
  }
};

// @desc  Create a pre-order
// @route POST /api/pre-orders
const createPreOrder = async (req, res) => {
  try {
    const {
      customerId,
      customerName,
      customerPhone,
      items,
      advanceAmount,
      expectedDate,
      notes,
      status
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    const orderNo = await generateOrderNo(req.user.id);
    
    // Calculate total amount from items
    const totalAmount = items.reduce((sum, item) => {
      const q = parseFloat(item.quantity) || 1;
      const p = parseFloat(item.price) || 0;
      return sum + (q * p);
    }, 0);

    const advance = parseFloat(advanceAmount) || 0;
    const due = Math.max(0, totalAmount - advance);

    // Verify customer if provided
    let finalCustomerName = customerName || null;
    let finalCustomerPhone = customerPhone || null;

    if (customerId) {
      const cust = await prisma.customer.findFirst({
        where: { id: customerId, userId: req.user.id }
      });
      if (cust) {
        finalCustomerName = cust.name;
        finalCustomerPhone = cust.phone || finalCustomerPhone;
      }
    }

    const preOrder = await prisma.preOrder.create({
      data: {
        orderNo,
        customerId: customerId || null,
        customerName: finalCustomerName,
        customerPhone: finalCustomerPhone,
        totalAmount,
        advanceAmount: advance,
        dueAmount: due,
        status: status || 'Pending',
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        notes: notes || null,
        userId: req.user.id,
        items: {
          create: items.map(item => ({
            productId: item.productId || null,
            name: item.name,
            quantity: parseFloat(item.quantity) || 1,
            price: parseFloat(item.price) || 0,
            total: (parseFloat(item.quantity) || 1) * (parseFloat(item.price) || 0)
          }))
        }
      },
      include: {
        customer: true,
        items: true
      }
    });

    return res.status(201).json(preOrder);
  } catch (error) {
    console.error('Create pre-order error:', error);
    return res.status(500).json({ message: 'Server error creating pre-order' });
  }
};

// @desc  Update pre-order status
// @route PATCH /api/pre-orders/:id/status
const updatePreOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const existing = await prisma.preOrder.findFirst({
      where: { id, userId: req.user.id }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Pre-order not found' });
    }

    const updated = await prisma.preOrder.update({
      where: { id },
      data: { status },
      include: {
        customer: true,
        items: true
      }
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Update pre-order status error:', error);
    return res.status(500).json({ message: 'Server error updating status' });
  }
};

// @desc  Update full pre-order
// @route PUT /api/pre-orders/:id
const updatePreOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customerId,
      customerName,
      customerPhone,
      items,
      advanceAmount,
      expectedDate,
      notes,
      status
    } = req.body;

    const existing = await prisma.preOrder.findFirst({
      where: { id, userId: req.user.id },
      include: { items: true }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Pre-order not found' });
    }

    let totalAmount = existing.totalAmount;
    if (items && Array.isArray(items)) {
      totalAmount = items.reduce((sum, item) => {
        const q = parseFloat(item.quantity) || 1;
        const p = parseFloat(item.price) || 0;
        return sum + (q * p);
      }, 0);
    }

    const advance = advanceAmount !== undefined ? parseFloat(advanceAmount) : existing.advanceAmount;
    const due = Math.max(0, totalAmount - advance);

    // Delete existing items if new items array passed
    if (items && Array.isArray(items)) {
      await prisma.preOrderItem.deleteMany({
        where: { preOrderId: id }
      });
    }

    const updated = await prisma.preOrder.update({
      where: { id },
      data: {
        customerId: customerId !== undefined ? (customerId || null) : existing.customerId,
        customerName: customerName !== undefined ? customerName : existing.customerName,
        customerPhone: customerPhone !== undefined ? customerPhone : existing.customerPhone,
        totalAmount,
        advanceAmount: advance,
        dueAmount: due,
        status: status || existing.status,
        expectedDate: expectedDate ? new Date(expectedDate) : (expectedDate === null ? null : existing.expectedDate),
        notes: notes !== undefined ? notes : existing.notes,
        ...(items && Array.isArray(items) ? {
          items: {
            create: items.map(item => ({
              productId: item.productId || null,
              name: item.name,
              quantity: parseFloat(item.quantity) || 1,
              price: parseFloat(item.price) || 0,
              total: (parseFloat(item.quantity) || 1) * (parseFloat(item.price) || 0)
            }))
          }
        } : {})
      },
      include: {
        customer: true,
        items: true
      }
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Update pre-order error:', error);
    return res.status(500).json({ message: 'Server error updating pre-order' });
  }
};

// @desc  Bulk delete pre-orders
// @route DELETE /api/pre-orders
const deletePreOrders = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Pre-order IDs are required' });
    }

    const result = await prisma.preOrder.deleteMany({
      where: {
        id: { in: ids },
        userId: req.user.id
      }
    });

    return res.status(200).json({ message: `Successfully deleted ${result.count} pre-order(s)` });
  } catch (error) {
    console.error('Delete pre-orders error:', error);
    return res.status(500).json({ message: 'Server error deleting pre-orders' });
  }
};

module.exports = {
  getPreOrders,
  getPreOrderById,
  createPreOrder,
  updatePreOrderStatus,
  updatePreOrder,
  deletePreOrders
};
