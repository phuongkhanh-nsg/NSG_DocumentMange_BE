const { google } = require("googleapis");
const mongoose = require("mongoose");
const User = mongoose.model("User");
const Document = mongoose.model("Document");

const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

// 1. Lấy URL để user login Google
async function  getGoogleAuthUrl  (req, res) {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
  });
  res.json({ url });
};

// 2. Callback sau khi user đồng ý
 const googleCallback = async (req, res) => {
  try {
    const { code } = req.query;
    
    // 🔥 KHỞI TẠO LẠI CLIENT TẠI ĐÂY
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
   

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ auth: oauth2Client, version: "v2" });
    const { data: profile } = await oauth2.userinfo.get();

    await User.findOneAndUpdate(
      { email: profile.email },
      {
        $set: {
          "google.googleId": profile.id,
          "google.accessToken": tokens.access_token,
          "google.refreshToken": tokens.refresh_token,
          "google.tokenExpiryDate": tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        },
      },
      { upsert: true, new: true }
    );

     res.redirect(process.env.FE_URL);
  } catch (error) {
    console.error("Google Callback Error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
};


// 3. Thêm sự kiện vào Calendar
const addCalendarEvent = async (req, res) => {
  try {
    const currentUser = req.user;
    const userId = currentUser._id;
    const { documentId } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.google?.refreshToken) {
      return res.status(400).json({ message: "User chưa kết nối Google" });
    }
    
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // ✅ CẢI TIẾN 1: Set cả access_token và refresh_token
    oauth2Client.setCredentials({
      access_token: user.google.accessToken,
      refresh_token: user.google.refreshToken,
      expiry_date: user.google.tokenExpiryDate 
        ? new Date(user.google.tokenExpiryDate).getTime() 
        : null,
    });

    // ✅ CẢI TIẾN 2: Sử dụng async/await trong event listener
    oauth2Client.on('tokens', async (tokens) => {
      try {
        const updateData = {};
        
        if (tokens.refresh_token) {
          updateData["google.refreshToken"] = tokens.refresh_token;
        }
        
        if (tokens.access_token) {
          updateData["google.accessToken"] = tokens.access_token;
          updateData["google.tokenExpiryDate"] = tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : null;
        }

        // Cập nhật một lần thay vì nhiều lần
        if (Object.keys(updateData).length > 0) {
          await User.findByIdAndUpdate(userId, updateData);
          console.log('✅ Tokens updated successfully');
        }
      } catch (err) {
        console.error('❌ Error updating tokens:', err);
      }
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    
    
    let startDateTime = new Date(document.createAt);
    let endDateTime = new Date(document.deadlineDay);

    if (endDateTime <= startDateTime) {
      endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // +1 giờ
    }
    const event = {
      summary: `${document.docNum}/${document.docCode} - ${document.shortDescription}`,
      description: document.note,
      start: { 
        dateTime: startDateTime.toISOString(), 
        timeZone: "Asia/Ho_Chi_Minh" 
      },
      end: { 
        dateTime: endDateTime.toISOString(), 
        timeZone: "Asia/Ho_Chi_Minh" 
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 },
          { method: "popup", minutes: 24 * 60 },
        ],
      },
    };

    const result = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
    });

    res.json({ 
      success: true,
      eventId: result.data.id,
      eventLink: result.data.htmlLink 
    });
    
  } catch (error) {
    console.error("Add Event Error:", error);
    
    // ✅ CẢI TIẾN 3: Xử lý lỗi chi tiết hơn
    if (error.code === 401) {
      return res.status(401).json({ 
        error: "Token không hợp lệ. Vui lòng kết nối lại Google" 
      });
    }
    
    res.status(500).json({ 
      error: "Failed to add event",
      details: error.message 
    });
  }
};

const checkGoogleAuth = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user || !user.google?.refreshToken) {
      return res.json({ googleConnected: false });
    }
    return res.status(200).json({
      googleConnected: true,
      googleId: user.google.googleId || null,
      scope: user.google.scope || null,
    });
  } catch (error) {
    console.error("Error in check google auth:", error);
    res.status(500).json({ error: "Failed to check google auth" });
  }
}
module.exports = {
  getGoogleAuthUrl,
  googleCallback,
  addCalendarEvent,
  checkGoogleAuth
};