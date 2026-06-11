const express = require('express');
const router = express.Router();
const statisticController = require('../controller/statistic.Controller')
const {verifyManager,verifyToken} = require('../middleware/authMiddleware');

router.get('/',verifyManager, statisticController.getUserStatistics)

module.exports = router;