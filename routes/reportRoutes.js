const express = require('express');
const controller = require('../controllers/reportController');
const { requireAuth } = require('../middleware/authMiddleware');
const router = express.Router();
router.use(requireAuth);
router.get('/dashboard', controller.dashboard);
router.get('/', controller.reports);
module.exports = router;
