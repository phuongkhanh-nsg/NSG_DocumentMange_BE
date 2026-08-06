const express = require('express');
const { handleChat } = require('../controller/chatbot.controller');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

router.post('/chat', authMiddleware.verifyToken, handleChat);

module.exports = router;
