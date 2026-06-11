const multer = require("multer");

const storage = multer.memoryStorage(); // 🔹 Lưu file vào RAM thay vì ổ cứng

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB
  },
});


module.exports = upload;
