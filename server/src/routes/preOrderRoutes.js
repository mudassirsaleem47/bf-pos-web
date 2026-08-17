const express = require('express');
const router = express.Router();
const {
  getPreOrders,
  getPreOrderById,
  createPreOrder,
  updatePreOrderStatus,
  updatePreOrder,
  deletePreOrders
} = require('../controllers/preOrderController');

router.get('/', getPreOrders);
router.post('/', createPreOrder);
router.delete('/', deletePreOrders);

router.get('/:id', getPreOrderById);
router.put('/:id', updatePreOrder);
router.patch('/:id/status', updatePreOrderStatus);

module.exports = router;
