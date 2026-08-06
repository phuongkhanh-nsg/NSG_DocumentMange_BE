const express = require('express');
const router = express.Router();
const repliedDocController = require('../controller/repliedDoc.Controller');
const upload = require("../middleware/multer");
const { verifyManager, verifyToken } = require('../middleware/authMiddleware');

router.post('/create', verifyToken, upload.array("files", 10), repliedDocController.replyDoc);
router.get('/search', verifyToken, repliedDocController.searchRepliedDocs);
router.post('/processReplyDoc', verifyManager, repliedDocController.updateReplyDocStatus);
router.get('/getByID/:userID', verifyToken, repliedDocController.getRepliedDocsByUser);
router.get('/getAll', verifyManager, repliedDocController.getAllRepliedDocs);
router.delete('/delete/:repliedDocId', verifyToken, repliedDocController.deleteRepliedDoc);
router.put('/update/:repliedDocId', verifyToken, upload.array("files", 10), repliedDocController.updateRepliedDoc);
router.get('/count/pending/:userID', verifyToken, repliedDocController.getPendingReplyCountForUser);
router.get('/count/pending/replied/:recipientID', verifyToken, repliedDocController.getPendingRepliesForRecipient);
router.get('/list/:recipientID', verifyToken, repliedDocController.getPendingRepliesListForRecipient);
router.post('/sentToReview', verifyToken, repliedDocController.sentToReview);
router.post('/reviewerAction', verifyToken, repliedDocController.reviewerAction);
router.get('/reviewed', verifyToken, repliedDocController.getReviewedDoc);
router.get('/count/inReview', verifyToken, repliedDocController.countInReviewReplyDocs);
router.get('/:repliedDocId', verifyToken, repliedDocController.getRepliedDocById);
router.get('/download/:fileId', verifyToken, repliedDocController.downloadDocument);

module.exports = router;
