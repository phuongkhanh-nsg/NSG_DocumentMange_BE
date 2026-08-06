const express = require('express');
const { getConfig, updateConfig } = require('../controller/chatbotConfig.controller');
const router = express.Router();

router.get('/', getConfig);
router.put('/', updateConfig);

module.exports = router;
