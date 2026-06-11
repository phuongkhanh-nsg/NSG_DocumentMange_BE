const { TEMPPASSWORD_EMAIL_TEMPLATE } = require("./emailTemplate");
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
module.exports = {
    sentTempPassword
}