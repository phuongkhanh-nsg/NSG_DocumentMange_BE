const express = require('express');
const router = express.Router();
const chartController = require('../controller/chart.Controller');  
const { verifyToken,verifyManager } = require('../middleware/authMiddleware');

router.get("/stats", chartController.getDocumentsStats);
router.get("/status-stats",  chartController.getDocumentsStatusStats);
module.exports = router;