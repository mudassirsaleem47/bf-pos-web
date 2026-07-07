const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { pushChanges, pullChanges } = require('../controllers/syncController');

router.post('/push', protect, pushChanges);
router.get('/pull', protect, pullChanges);

module.exports = router;
