const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const ChatbotConfig = require("../models/chatbotConfig.model");
const Task = require("../models/task.model");
const Document = require("../models/document.model");
const User = require("../models/user.model");

const handleChat = async (req, res) => {
  try {
    const { message, isInit, history } = req.body;
    const userId = req.user?.id || req.body.userId;

    if (!message && !isInit) {
      return res.status(400).json({ success: false, message: "Tin nhắn không được để trống" });
    }

    // Clean up history to meet Gemini requirements (must start with user, must alternate)
    let validHistory = [];
    if (Array.isArray(history)) {
        let lastRole = null;
        for (const msg of history) {
            // Ignore bot's initial greeting if it's the first message
            if (msg.role === 'model' && validHistory.length === 0) continue;
            // Ignore consecutive messages from the same role
            if (msg.role === lastRole) continue;
            
            validHistory.push(msg);
            lastRole = msg.role;
        }
        // If the last message is from user (meaning the API failed previously), remove it so we end with 'model'
        if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === 'user') {
            validHistory.pop();
        }
    }

    const config = await ChatbotConfig.findOne();
    if (!config || !config.isActive || !config.geminiApiKey) {
      return res.status(403).json({ success: false, message: "Chatbot hiện đang bảo trì hoặc chưa được cấu hình." });
    }

    const genAI = new GoogleGenerativeAI(config.geminiApiKey);

    let userName = "Người dùng";
    let userDataContext = "";
    let todoTaskCount = 0;
    let unreadDocCount = 0;

    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        userName = user.name || "Người dùng";
        
        todoTaskCount = await Task.countDocuments({
          $or: [ { assignees: userId }, { collaborators: userId } ],
          status: { $in: ['TODO', 'IN_PROGRESS'] }
        });

        unreadDocCount = await Document.countDocuments({
          "assignedToUsers": { $elemMatch: { userId: userId, isRead: false } }
        });

        userDataContext = `Thông tin cá nhân: Tên bạn là ${userName}. Hiện có ${todoTaskCount} công việc cần xử lý và ${unreadDocCount} văn bản mới chưa xem. ID người dùng là ${userId}.`;
      }
    }

    if (isInit) {
      return res.status(200).json({ 
        success: true, 
        reply: `👋 Chào ${userName}, Em là Chatbot AI QLVB NSG! Hôm nay em có thể giúp gì cho mình ạ? ✨\n\n📌 Hiện tại, bạn đang có **${todoTaskCount}** công việc cần xử lý và **${unreadDocCount}** văn bản mới chưa xem đó.`,
        suggestions: ["Tôi có văn bản nào chưa xem?", "Liệt kê công việc chưa làm", "Tìm văn bản về trí tuệ nhân tạo"]
      });
    }

    // Tools definition
    const tools = [{
      functionDeclarations: [
        {
          name: "searchUserDocuments",
          description: "Tìm kiếm văn bản đến, đi hoặc nội bộ của người dùng dựa trên từ khoá (như số hiệu, trích yếu, tên văn bản). Gọi hàm này khi người dùng hỏi về một văn bản cụ thể.",
          parameters: {
            type: SchemaType ? SchemaType.OBJECT : "object",
            properties: {
              keyword: {
                type: SchemaType ? SchemaType.STRING : "string",
                description: "Từ khoá chính cần tìm kiếm (CHỈ trích xuất các từ quan trọng nhất, sửa lỗi chính tả nếu có, BỎ các từ thừa như 'văn bản liên quan đến', 'là gì', 'tìm cho tôi'). Ví dụ: 'lái xe ô tô hạng B', '2588', 'báo cáo', 'quyết định'."
              }
            },
            required: ["keyword"]
          }
        },
        {
          name: "searchUserTasks",
          description: "Tìm kiếm danh sách công việc của người dùng dựa trên từ khoá (như tên công việc, trạng thái khẩn, đang làm...).",
          parameters: {
            type: SchemaType ? SchemaType.OBJECT : "object",
            properties: {
              keyword: {
                type: SchemaType ? SchemaType.STRING : "string",
                description: "Từ khoá cần tìm kiếm (ví dụ: 'khẩn', 'họp', 'chưa làm')."
              }
            },
            required: ["keyword"]
          }
        }
      ]
    }];

    const systemInstruction = `Bạn là trợ lý ảo thông minh của Hệ thống Quản lý Văn bản NSG.
Nhiệm vụ của bạn là trả lời các câu hỏi dựa trên thông tin cá nhân của người dùng.
${userDataContext}
Trả lời ngắn gọn, súc tích, lịch sự và chính xác. Không bịa đặt.
Nếu cần tìm chi tiết văn bản hay công việc, hãy sử dụng các công cụ tìm kiếm (tools) được cung cấp.
Khi trả lời về văn bản/công việc có Tệp đính kèm, HÃY CHÈN ĐƯỜNG LINK THEO CÚ PHÁP MARKDOWN để người dùng click vào xem, dạng: [Tên file](https://drive.google.com/file/d/MÃ_FILE/view).
Ví dụ: [Văn bản.pdf](https://drive.google.com/file/d/1abc.../view)`;

    let model;
    try {
      model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction,
        tools 
      });
    } catch (e) {
      model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-pro",
        systemInstruction,
        tools 
      });
    }

    const chat = model.startChat({ history: validHistory });
    const result = await chat.sendMessage(message);
    const response = await result.response;
    let finalAnswer = response.text();

    const functionCalls = response.functionCalls();
    
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      let functionResponseData = { result: "Không tìm thấy dữ liệu phù hợp." };
      
      try {
        if (call.name === "searchUserDocuments" && userId) {
          const kw = call.args.keyword || "";
          
          const matchNum = kw.match(/\d+/);
          const numToSearch = matchNum ? parseInt(matchNum[0], 10) : null;
          
          const orConditions = [
            { docCode: { $regex: kw, $options: "i" } },
            { shortDescription: { $regex: kw, $options: "i" } }
          ];
          
          if (numToSearch) {
            orConditions.push({ docNum: numToSearch });
          }

          const docs = await Document.find({
            $and: [
              { $or: [ { "assignedToUsers.userId": userId }, { sentBy: userId } ] },
              { $or: orConditions }
            ]
          }).sort({ createdAt: -1 }).limit(10);
          
          if (docs.length > 0) {
            functionResponseData = docs.map(d => ({
              soHieu: (d.docNum && d.docCode) ? `${d.docNum}/${d.docCode}` : (d.docCode || d.docNum || 'N/A'),
              trichYeu: d.shortDescription,
              trangThai: d.assignedToUsers.find(u => u.userId.toString() === userId.toString())?.status || 'received',
              mucDoKhan: d.urgency,
              tepDinhKem: d.files?.map(f => ({ ten: f.fileName, link: `https://drive.google.com/file/d/${f.fileId}/view` })) || []
            }));
          }
        } else if (call.name === "searchUserTasks" && userId) {
          const kw = call.args.keyword || "";
          const tasks = await Task.find({
            $and: [
              { $or: [ { assignees: userId }, { collaborators: userId }, { createdBy: userId } ] },
              { $or: [
                { title: { $regex: kw, $options: "i" } },
                { description: { $regex: kw, $options: "i" } },
                { status: { $regex: kw, $options: "i" } },
                { priority: { $regex: kw, $options: "i" } }
              ] }
            ]
          }).sort({ createdAt: -1 }).limit(10);
          
          if (tasks.length > 0) {
            functionResponseData = tasks.map(t => ({
              tieuDe: t.title,
              trangThai: t.status,
              mucDo: t.priority,
              hanChot: t.dueDate,
              tepDinhKem: t.files?.map(f => ({ ten: f.fileName, link: `https://drive.google.com/file/d/${f.fileId}/view` })) || []
            }));
          }
        }
        
        // Send the function response back to the model
        const functionResponseResult = await chat.sendMessage([{
          functionResponse: {
            name: call.name,
            response: { results: functionResponseData }
          }
        }]);
        
        finalAnswer = functionResponseResult.response.text();
        
      } catch (err) {
        console.error("Function call error:", err);
      }
    }

    res.status(200).json({ success: true, reply: finalAnswer });
  } catch (error) {
    console.error("Chatbot error:", error);
    res.status(500).json({ success: false, message: "Lỗi kết nối tới AI Chatbot.", error: error.message });
  }
};

module.exports = {
  handleChat
};
