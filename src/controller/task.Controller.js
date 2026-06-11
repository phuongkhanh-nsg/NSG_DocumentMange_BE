const Task = require("../models/task.model");

const createTask = async (req, res) => {
    try {
        const { title, description, startDate, endDate, assignees, relatedDocument } = req.body;
        const createdBy = req.user ? req.user._id : req.body.createdBy;

        const newTask = new Task({
            title,
            description,
            startDate,
            endDate,
            assignees,
            relatedDocument,
            createdBy
        });

        await newTask.save();
        res.status(201).json({ success: true, message: "Task created successfully", data: newTask });
    } catch (error) {
        console.error("Error creating task:", error);
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

const getTasks = async (req, res) => {
    try {
        const { userId } = req.query; // If provided, filter by assignee or creator

        let filter = {};
        if (userId) {
            filter = {
                $or: [
                    { createdBy: userId },
                    { assignees: userId }
                ]
            };
        }

        const tasks = await Task.find(filter)
            .populate("assignees", "name email")
            .populate("createdBy", "name email")
            .populate("relatedDocument", "docCode shortDescription")
            .sort({ startDate: 1 });

        res.status(200).json({ success: true, data: tasks });
    } catch (error) {
        console.error("Error fetching tasks:", error);
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

const updateTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const updates = req.body;

        const updatedTask = await Task.findByIdAndUpdate(taskId, updates, { new: true });
        if (!updatedTask) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }

        res.status(200).json({ success: true, message: "Task updated", data: updatedTask });
    } catch (error) {
        console.error("Error updating task:", error);
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

const deleteTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const deletedTask = await Task.findByIdAndDelete(taskId);
        
        if (!deletedTask) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }

        res.status(200).json({ success: true, message: "Task deleted successfully" });
    } catch (error) {
        console.error("Error deleting task:", error);
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

module.exports = {
    createTask,
    getTasks,
    updateTask,
    deleteTask
};
