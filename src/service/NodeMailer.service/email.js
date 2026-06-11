const { TEMPPASSWORD_EMAIL_TEMPLATE, NEW_DOCUMENT_EMAIL_TEMPLATE } = require("./emailTemplate");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

const createTransporter = () => {
    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // true cho port 465, false cho các port khác
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  };

const sentTempPassword = async (email,tempPass) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: '"Hệ thống quản lý văn bản NSG" <qlvb@nsgpc.edu.vn>', // sender address
            to: email, // list of receivers
            subject: "OTP tạm thời", // Subject line
            text: "Mã khôi phục mật khẩu", // plain text body
            html: TEMPPASSWORD_EMAIL_TEMPLATE.replace("{tempPass}",tempPass),
        }
        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error("Error sending temp password to email:", error);

    }
}

const sendNewDocumentEmail = async (emails, docData) => {
    try {
        if (!emails || emails.length === 0) return;
        const transporter = createTransporter();
        
        let htmlContent = NEW_DOCUMENT_EMAIL_TEMPLATE
            .replace("{docCode}", docData.docCode || "N/A")
            .replace("{shortDescription}", docData.shortDescription || "N/A")
            .replace("{docType}", docData.docType === "received" ? "Văn bản đến" : "Văn bản đi")
            .replace("{urgency}", docData.urgency || "Bình thường");

        const mailOptions = {
            from: '"Hệ thống quản lý văn bản NSG" <qlvb@nsgpc.edu.vn>',
            to: emails.join(", "), 
            subject: "[NSG] Thông báo văn bản mới",
            html: htmlContent,
        }
        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error("Error sending document notification to email:", error);
    }
}

module.exports = {
    sentTempPassword,
    sendNewDocumentEmail
}