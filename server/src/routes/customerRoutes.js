const express = require('express');
const router = express.Router();
const {
  getCustomers,
  receivePayment,
  createCustomer,
  updateCustomer,
  deleteCustomers
} = require('../controllers/customerController');

router.get('/', getCustomers);
router.post('/', createCustomer);
router.post('/:id/payment', receivePayment);
router.put('/:id', updateCustomer);
router.delete('/', deleteCustomers);

module.exports = router;
