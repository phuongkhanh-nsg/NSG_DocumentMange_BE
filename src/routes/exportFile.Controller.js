const express = require('express');
const router = express.Router();

const exportDocumentsToExcel = require('../controller/exportFile.Controller')
const {verifyManager,verifyToken} = require('../middleware/authMiddleware');

router.get('/',verifyManager,exportDocumentsToExcel.exportDocumentsToExcel)
router.get('/userStatistics',verifyManager,exportDocumentsToExcel.exportAllUserStatistics)
router.get('/repliedDocs',verifyToken,exportDocumentsToExcel.exportRepliedDocsToExcel)
module.exports = router