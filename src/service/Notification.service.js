const { sendNewDocumentEmail } = require("./NodeMailer.service/email");
const User = require("../models/user.model");

const triggerDocumentNotifications = async (document) => {
    try {
        const { assignees, departmentExecutors } = document;
        let targetUsers = [];

        if (assignees && assignees.length > 0) {
            const users = await User.find({ _id: { $in: assignees } }).select("email mobile");
            targetUsers = [...targetUsers, ...users];
        }

        if (departmentExecutors && departmentExecutors.length > 0) {
            const deptUsers = await User.find({ department: { $in: departmentExecutors } }).select("email mobile");
            targetUsers = [...targetUsers, ...deptUsers];
        }

        const uniqueUsers = Array.from(new Set(targetUsers.map(u => u._id.toString())))
            .map(id => targetUsers.find(u => u._id.toString() === id));

        const emails = uniqueUsers.map(u => u.email).filter(e => e);

        if (emails.length > 0) {
            sendNewDocumentEmail(emails, document).catch(err => console.error("Email Notify Error:", err));
        }

    } catch (error) {
        console.error("Error in triggerDocumentNotifications:", error);
    }
};

module.exports = {
    triggerDocumentNotifications
};
