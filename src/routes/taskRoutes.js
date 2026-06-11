const express = require('express');
const router = express.Router();
const taskController = require('../controller/task.Controller');
// const { verifyToken } = require('../middleware/authMiddleware'); // if auth middleware exists

// If there's auth middleware, we should use it. For now, matching existing patterns.
router.post('/', taskController.createTask);
router.get('/', taskController.getTasks);
router.put('/:taskId', taskController.updateTask);
router.delete('/:taskId', taskController.deleteTask);

module.exports = router;
