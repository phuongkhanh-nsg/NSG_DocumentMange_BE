const { sendNewDocumentEmail } = require("./NodeMailer.service/email");
const { sendNewDocumentZalo } = require("./Zalo.service");
const User = require("../models/user.model");

const triggerDocumentNotifications = async (document) => {
    try {
        const userIdsToNotify = new Set();
        
        if (document.assignedToUsers && document.assignedToUsers.length > 0) {
            document.assignedToUsers.forEach(u => userIdsToNotify.add(u.userId.toString()));
        }

        if (document.executors && document.executors.length > 0) {
            for (const exec of document.executors) {
                if (exec.executorType === "User") {
                    userIdsToNotify.add(exec.executorId.toString());
                } else if (exec.executorType === "Department") {
                    // Fetch all users in this department
                    const deptUsers = await User.find({ department: exec.executorId, role: { $ne: null } }).select('_id');
                    deptUsers.forEach(u => userIdsToNotify.add(u._id.toString()));
                }
            }
        }

        if (userIdsToNotify.size === 0) return;

        const users = await User.find({ _id: { $in: Array.from(userIdsToNotify) } }).select('email mobile');
        
        const emails = users.map(u => u.email).filter(e => e);
        const phones = users.map(u => u.mobile).filter(p => p);

        // Send notifications asynchronously
        if (emails.length > 0) {
            sendNewDocumentEmail(emails, document).catch(err => console.error("Email Notify Error:", err));
        }

        if (phones.length > 0) {
            sendNewDocumentZalo(phones, document).catch(err => console.error("Zalo Notify Error:", err));
        }

    } catch (error) {
        console.error("Error in triggerDocumentNotifications:", error);
    }
};

module.exports = {
    triggerDocumentNotifications
};
