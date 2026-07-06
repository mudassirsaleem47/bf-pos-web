const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');

router.post('/push', syncController.push);
router.get('/pull', syncController.pull);
router.post('/run', syncController.triggerSync);
router.get('/status', syncController.getStatus);

module.exports = router;
