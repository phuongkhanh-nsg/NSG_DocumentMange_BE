const express = require('express');
const router = express.Router();
const taskController = require('../controller/task.Controller');
const upload = require('../middleware/multer');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/', verifyToken, upload.array('files', 10), taskController.createTask);
router.get('/', verifyToken, taskController.getTasks);
router.put('/:taskId', verifyToken, upload.array('files', 10), taskController.updateTask);
router.delete('/:taskId', verifyToken, taskController.deleteTask);

module.exports = router;
