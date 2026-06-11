const express = require('express');
const router = express.Router();

const googleService = require('../controller/google.Controller')
const {verifyManager,verifyToken} = require('../middleware/authMiddleware');

router.get("/auth",verifyToken, googleService.getGoogleAuthUrl);

// Callback sau khi user đồng ý (Google redirect về)
router.get("/callback", googleService.googleCallback);

// Endpoint thêm sự kiện (gọi sau khi user đã liên kết Google)
router.post("/calendar",verifyToken, googleService.addCalendarEvent);

router.get("/check",verifyToken, googleService.checkGoogleAuth);    

module.exports = router