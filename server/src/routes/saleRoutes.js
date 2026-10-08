const express = require('express');
const router = express.Router();
const { getSales, createSale, deleteSales, returnSaleItems } = require('../controllers/saleController');

router.get('/', getSales);
router.post('/', createSale);
router.post('/:id/return', returnSaleItems);
router.delete('/', deleteSales);

module.exports = router;
