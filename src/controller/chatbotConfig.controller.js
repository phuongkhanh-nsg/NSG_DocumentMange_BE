const ChatbotConfig = require("../models/chatbotConfig.model");

const getConfig = async (req, res) => {
  try {
    let config = await ChatbotConfig.findOne();
    if (!config) {
      config = await ChatbotConfig.create({});
    }
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    console.error("Error fetching chatbot config:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ", error: error.message });
  }
};

const updateConfig = async (req, res) => {
  try {
    const { isActive, geminiApiKey, primaryColor, position, width, height } = req.body;
    let config = await ChatbotConfig.findOne();
    if (!config) {
      config = new ChatbotConfig();
    }
    
    if (isActive !== undefined) config.isActive = isActive;
    if (geminiApiKey !== undefined) config.geminiApiKey = geminiApiKey;
    if (primaryColor !== undefined) config.primaryColor = primaryColor;
    if (position !== undefined) config.position = position;
    if (width !== undefined) config.width = width;
    if (height !== undefined) config.height = height;

    await config.save();
    res.status(200).json({ success: true, message: "Cập nhật cấu hình thành công", data: config });
  } catch (error) {
    console.error("Error updating chatbot config:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ", error: error.message });
  }
};

module.exports = {
  getConfig,
  updateConfig,
};
