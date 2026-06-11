const { google } = require("googleapis");
const fs = require("fs");
const Document = require("../models/document.model");
const User = require("../models/user.model") // Your Mongoose model
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { Readable } = require("stream");
const { sign } = require("crypto");

dotenv.config();

// Google Drive Authentication
async function authorize() {
    const auth = new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL,
        null,       
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"), // Fix line breaks in private key
        ["https://www.googleapis.com/auth/drive"]
    );
    await auth.authorize();
    return auth;
}

async function uploadToDrive(req, res) {
  try {
    

    const parseJSON = (data) => {
      try {
        return typeof data === "string" ? JSON.parse(data) : data;
      } catch (error) {
        throw new Error(`Invalid JSON format for: ${data}`);
      }
    };

    let {
      sentBy,
      docType,
      docVariant,
      year,
      deadlineDay,
      docNum,
      docCode,
      unit,
      signer,
      position,
      departments,
      assignedToUsers,
      principalIdea,
      numOfPages,
      shortDescription,
      note,
      urgency,
      saveAt,
      executors,
      createAt,
      receivedAt
    } = req.body;

    if (!sentBy ) {
      return res.status(400).json({ message: "Missing required field: sentBy" });
    }

    if (docType === 'received' && signer == null) 
    {
      const signerUser = await User.findOne({ position: "680eb8eaf148d83d0fd5344a" });

      if (!signerUser) {
          throw new Error("Không tìm thấy user với position = hiệu trưởng");
      }

      signer = signerUser._id;
    }
    console.log("signer:", signer);

    const auth = await authorize();
    const drive = google.drive({ version: "v3", auth });

    // Parse fields only if they are strings
    const parsedExecutors = parseJSON(executors);
    const parsedAssignedToUsers = parseJSON(assignedToUsers);

    // Xử lý trường departments: nếu là chuỗi JSON thì parse, nếu không thì giữ nguyên
    let parsedDepartments = typeof departments === "string" ? parseJSON(departments) : departments;
    if (!Array.isArray(parsedDepartments)) {
      parsedDepartments = [parsedDepartments];
    }

    const uploadedFiles = [];

    for (const file of req.files) {
      const fileMetadata = {
        name: file.originalname,
        parents: [process.env.DRIVE_FOLDER_ID],
      };

      const media = {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),
      };

      const response = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id, name, mimeType, size",
      });

      uploadedFiles.push({
        fileId: response.data.id,
        fileName: response.data.name,
        mimeType: response.data.mimeType,
        size: response.data.size,
      });
    }

    // Save document to MongoDB
    const newDocument = new Document({
      sentBy,
      docType,
      docVariant,
      year,
      deadlineDay,
      docNum,
      docCode,
      unit,
      signer,
      position,
      departments: parsedDepartments, // Dùng mảng đã được xử lý
      assignedToUsers: parsedAssignedToUsers,
      principalIdea,
      numOfPages,
      shortDescription,
      note,
      urgency,
      saveAt,
      executors: parsedExecutors,
      createAt: createAt ? new Date(createAt) : undefined,
      unit: docType === 'received' ? unit : undefined,
      files: uploadedFiles,
      receivedAt: receivedAt ? new Date(receivedAt) : undefined,
    });

    await newDocument.save();

    // Trigger notifications for new document
    const { triggerDocumentNotifications } = require("../service/Notification.service");
    triggerDocumentNotifications(newDocument);

    res.status(201).json({
      message: "Files uploaded successfully!",
      document: newDocument,
    });
  } catch (error) {
    console.error("Error in uploadToDrive:", error);
    res.status(500).json({ message: "Error uploading files", error: error.message });
  }
}

const getAllDocuments = async (req, res) => {
  try {
    const { userId, page = 1, limit = 10 } = req.query; // Nhận userId, page, limit từ FE

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    // Tìm thông tin user từ database
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let filter = {};

    // Nếu user không phải admin/manager thì chỉ lấy document liên quan
    if (user.role !== "admin" && user.role !== "manager") {
      filter = {
        $or: [
          { sentBy: userId },
          { "executors.executorId": userId },
          { "assignedToUsers.userId": userId },
        ],
      };
    }

    // ===== Pagination =====
    const skip = (Number(page) - 1) * Number(limit);

    const [documents, totalDocuments] = await Promise.all([
      Document.find(filter)
        .populate("docVariant")
        .populate("signer", "name email")
        .populate("position", "positionName")
        .populate("departments", "departmentName")
        .populate("executors.executorId", "name")
        .populate("assignedToUsers.userId", "name email")
        .populate("sentBy", "name")
        .populate("urgency", "urgency")
        .populate("docCode", "docCode")
        .populate("saveAt", "saveAt")
        .populate("createAt", "createAt")
        .populate("unit", "unitName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Document.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      totalDocuments,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(totalDocuments / limit),
      data: documents,
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching documents",
      error: error.message,
    });
  }
};



const getDocumentById = async (req, res) => {
    try {
        const { documentId } = req.params;

        if (!documentId) {
            return res.status(400).json({ success: false, message: "Document ID is required" });
        }

        const document = await Document.findById(documentId)
            .populate("docVariant")
            .populate("signer", "name email")
            .populate("position", "positionName")
            .populate("departments", "departmentName")
            .populate("executors.executorId", "name")
            .populate("assignedToUsers.userId", "name email")
            .populate("sentBy", "name")
            .populate("urgency", "urgency")
            .populate("docCode", "docCode")
            .populate("unit", "unitName")
            .populate("createAt", "createAt")
            .populate("saveAt", "saveAt")
            .populate("receivedAt", "receivedAt");


        if (!document) {
            return res.status(404).json({ success: false, message: "Document not found" });
        }

        res.status(200).json({ success: true, data: document });
    } catch (error) {
        console.error("Error fetching document:", error);
        res.status(500).json({ success: false, message: "Error fetching document", error: error.message });
    }
};
  
const getNextDocNum = async (req, res) => {
    try {
        const { docType,docVariantId, year } = req.params; 

        if (!docVariantId || !year || !docType) {
            return res.status(400).json({ 
                success: false, 
                message: "docVariantId, docType and year are required" 
            });
        }


        const lastDoc = await Document.findOne({ docVariant: docVariantId, docType:docType, year })
          .sort({ docNum: -1 })
          .select("docNum");

        const nextDocNum = lastDoc ? lastDoc.docNum + 1 : 1; // Nếu không có tài liệu nào, bắt đầu từ 1

        res.status(200).json({ 
            success: true, 
            nextDocNum:nextDocNum 
        });
       
    } catch (error) {
        console.error("Error fetching next docNum:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching next document number",
            error: error.message,
        });
    }
};
  
const getDocumentsByUserAndType = async (req, res) => {
    try {
        const { userId, docType } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const pageNumber = parseInt(page);
        const pageSize = parseInt(limit);

        if (!userId || !["sent", "received"].includes(docType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid userId or docType. docType must be 'sent' or 'received'.",
            });
        }

        let filterCondition = {};

        // 🔹 Lọc văn bản theo loại
        if (docType === "sent") {
            filterCondition = { sentBy: userId, docType: "sent" }; // Lọc theo sentBy
        } else if (docType === "received") {
            // filterCondition = {
            //   docType: "received",
            //   assignedToUsers: { $elemMatch: { userId: userId, status: "received" } },
            // };
            filterCondition = {
              $or: [
                { docType: "received" },
                { assignedToUsers: { $elemMatch: { userId: userId, status: "received" } } }
              ]
            };
        }

        // 🔹 Truy vấn văn bản
        const documents = await Document.find(filterCondition)
            .populate("sentBy", "name ")
            .populate("docVariant")
            .populate("signer", "name email")
            .populate("position", "positionName")
            .populate("departments", "departmentName")
            .populate("executors.executorId", "name")
            .populate("assignedToUsers.userId", "name email")
            .populate("sentBy", "name")
            .populate("docCode", "docCode")
            .populate("unit", "unitName")
            .populate("urgency", "urgency")
            .populate("saveAt", "saveAt")
            .populate("createAt", "createAt")
            .sort({ createdAt: -1 })
            .skip((pageNumber - 1) * pageSize)
            .limit(pageSize);

        const totalDocuments = await Document.countDocuments(filterCondition);
        const totalPages = Math.ceil(totalDocuments / pageSize);

        res.status(200).json({
            success: true,
            userId,
            docType,
            currentPage: pageNumber,
            totalPages,
            totalDocuments,
            data: documents,
        });
    } catch (error) {
        console.error("Error fetching documents:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching documents",
            error: error.message,
        });
    }
};
const getFilteredDocuments = async (req, res) => {
    try {
      let { 
        page = 1, 
        limit = 10, 
        docType, 
        docCode, 
        shortDescription, 
        departments, 
        sentBy, 
        docNum, 
        deadlineDay,
        unit
      } = req.query;
  
      const pageNumber = parseInt(page);
      const pageSize = parseInt(limit);
  
      // ✅ Tạo bộ lọc động theo các điều kiện
      let filter = {};
      if (docType) filter.docType = docType;
      if (docCode) filter.docCode = { $regex: docCode, $options: "i" }; // Tìm kiếm gần đúng
      if (shortDescription) filter.shortDescription = { $regex: shortDescription, $options: "i" };
      if (sentBy) filter.sentBy = sentBy;
      if (docNum) filter.docNum = docNum;
      if (deadlineDay) filter.deadlineDay = new Date(deadlineDay);
      if (departments) filter.departments = { $in: departments.split(",") }; // Cho phép chọn nhiều ID phòng ban
      if (unit) filter.unit = unit;
  
      // ✅ Đếm tổng số tài liệu để tính tổng trang
      const totalDocuments = await Document.countDocuments(filter);
      const totalPages = Math.ceil(totalDocuments / pageSize);
  
      // ✅ Lấy dữ liệu với filter, phân trang & sắp xếp
      const documents = await Document.find(filter)
        .populate("docVariant")
        .populate("signer", "name email")
        .populate("position", "positionName")
        .populate("departments", "departmentName")
        .populate("executors.executorId", "name")
        .populate("assignedToUsers.userId", "name email")
        .populate("sentBy", "name")
        .populate("urgency", "urgency")
        .populate("docCode", "docCode")
        .populate("saveAt", "saveAt")
        .populate("createAt", "createAt")
        .populate("unit", "unitName")
        .sort({ createdAt: -1 }) // Sắp xếp theo điều kiện
        .skip((pageNumber - 1) * pageSize) // Áp dụng phân trang
        .limit(pageSize); // Giới hạn số tài liệu mỗi trang
  
      res.status(200).json({
        success: true,
        currentPage: pageNumber,
        totalPages,
        totalDocuments,
        data: documents,
      });
    } catch (error) {
      console.error("Error fetching filtered documents:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching documents",
        error: error.message,
      });
    }
};

const deleteDocument = async (req, res) => {
    try {
        const { documentId, userID } = req.params;

        // Tìm document trước khi xóa
        const document = await Document.findById(documentId);
        const auth = await authorize();
        const drive = google.drive({ version: "v3", auth });
        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }

        // Lấy thông tin user
        const user = await User.findById(userID);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Kiểm tra quyền: nếu không phải admin và cũng không phải người gửi thì từ chối
        if (user.role !== "admin" && document.sentBy.toString() !== userID) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to delete this document",
            });
        }

        // 🧠 Nếu có file Drive, xóa file trước
        if (document.files && Array.isArray(document.files) && document.files.length > 0) {
            for (const file of document.files) {
                try {
                    await drive.files.delete({ fileId: file.fileId });
                    console.log(`Deleted file from Drive: ${file.fileId}`);
                } catch (err) {
                    console.warn(`Failed to delete file ${file.fileId} on Drive:`, err.message);
                }
            }
        }

        // Xóa document khỏi MongoDB
        await Document.findByIdAndDelete(documentId);

        res.status(200).json({
            success: true,
            message: "Document and associated files deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting document:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting document",
            error: error.message
        });
    }
};

async function isRead(req, res) {
  try {
    const { userId, documentId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({ message: "Invalid documentId" });
    }

    // Update trực tiếp vào assignedToUsers.$[elem]
    const result = await Document.updateOne(
      { _id: documentId, "assignedToUsers.userId": userId },
      {
        $set: {
          "assignedToUsers.$.isRead": true,
          "assignedToUsers.$.receivedDate": new Date(),
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found in assignedToUsers" });
    }

    res.status(200).json({
      success: true,
      message: "Marked as read successfully",
    });
  } catch (error) {
    console.error("Error in isRead:", error);
    res.status(500).json({
      success: false,
      message: "Error in isRead",
      error: error.message,
    });
  }
}


async function updateDocument(req, res) {
    try {
      const { documentId } = req.params;
  
      if (!documentId) {
        return res.status(400).json({ message: "Missing document ID" });
      }
  
      let existingDocument = await Document.findById(documentId);
      if (!existingDocument) {
        return res.status(404).json({ message: "Document not found" });
      }
  
      const auth = await authorize(); // Giả sử authorize() là hàm xác thực Google API
      const drive = google.drive({ version: "v3", auth });
  
      const fieldsToUpdate = [
        "sentBy",
        "docType",
        "docVariant",
        "year",
        "deadlineDay",
        "docNum",
        "docCode",
        "unit",
        "signer",
        "position",
        "departments",
        "assignedToUsers",
        "principalIdea",
        "numOfPages",
        "shortDescription",
        "note",
        "urgency",
        "saveAt",
        "executors",
        "createAt",
        "receivedAt",
      ];
  
      for (const field of fieldsToUpdate) {
        if (req.body[field] !== undefined) {
          if (field === "executors") {
            if (typeof req.body.executors === "string") {
              try {
                req.body.executors = JSON.parse(req.body.executors);
              } catch (error) {
                return res.status(400).json({ message: "Invalid format for executors" });
              }
            }
            if (!Array.isArray(req.body.executors)) {
              return res.status(400).json({ message: "Executors must be an array" });
            }
            existingDocument[field] = req.body.executors;
          } else if (field === "assignedToUsers" && typeof req.body.assignedToUsers === "string") {
            try {
              req.body.assignedToUsers = JSON.parse(req.body.assignedToUsers);
            } catch (error) {
              return res.status(400).json({ message: "Invalid format for assignedToUsers" });
            }
            existingDocument[field] = req.body.assignedToUsers;
          } else if (field === "departments") {
            let departments = req.body.departments;
            if (typeof departments === "string") {
              try {
                departments = JSON.parse(departments);
              } catch (error) {
                departments = [departments];
              }
            } else if (!Array.isArray(departments)) {
              departments = [departments];
            }
            existingDocument[field] = departments;
          } else if (field === "deadlineDay") {
            const deadline = req.body.deadlineDay;
            if (deadline === null || deadline === "" || deadline === undefined) {
              existingDocument.deadlineDay = null;
            } else {
              const parsed = new Date(deadline);
              if (!isNaN(parsed)) {
                existingDocument.deadlineDay = parsed;
              } else {
                return res.status(400).json({ message: "Invalid deadlineDay format" });
              }
            }
          } else if (field === "createAt" && typeof req.body.createAt === "string") {
            existingDocument[field] = new Date(req.body.createAt);
          }  else if (field === "receivedAt") {
            const received = req.body.receivedAt;
            if (received === null || received === "" || received === undefined) {
              existingDocument.receivedAt = null;
            } else {
              const parsed = new Date(received);
              if (!isNaN(parsed.getTime())) {
                existingDocument.receivedAt = parsed;
              } else {
                return res.status(400).json({ message: "Invalid receivedAt format" });
              }
            }
          }
           else if (field === "unit") {
            if (existingDocument.docType === 'received') {
              existingDocument[field] = req.body[field] || undefined;
            } else {
              existingDocument[field] = undefined;
            }
          } else {
            existingDocument[field] = req.body[field];
          }
        }
      }
  
      // Handle file updates
      let updatedFiles = existingDocument.files || [];
  
      // Xử lý existingFiles từ req.body
      if (req.body.existingFiles) {
        try {
          const parsedExistingFiles = JSON.parse(req.body.existingFiles);
          if (!Array.isArray(parsedExistingFiles)) {
            return res.status(400).json({ message: "existingFiles must be an array" });
          }
  
          // Xóa file khỏi Google Drive nếu không còn trong existingFiles
          const currentFileIds = existingDocument.files.map(f => f.fileId);
          const newFileIds = parsedExistingFiles.map(f => f.fileId);
          const deletedFileIds = currentFileIds.filter(id => !newFileIds.includes(id));
  
          for (const fileId of deletedFileIds) {
            try {
              await drive.files.delete({ fileId });
            } catch (error) {
              console.error(`Failed to delete file ${fileId} from Google Drive:`, error);
              // Có thể tiếp tục hoặc trả về lỗi tùy thuộc vào yêu cầu
            }
          }
  
          // Cập nhật danh sách file cũ
          updatedFiles = parsedExistingFiles.map(file => ({
            fileId: file.fileId,
            fileName: file.fileName,
            mimeType: file.mimeType,
            size: file.size || '', // Nếu schema yêu cầu size
          }));
        } catch (error) {
          return res.status(400).json({ message: "Invalid format for existingFiles" });
        }
      }
  
      // Thêm file mới nếu có
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const fileMetadata = {
            name: file.originalname,
            parents: [process.env.DRIVE_FOLDER_ID],
          };
  
          const media = {
            mimeType: file.mimetype,
            body: Readable.from(file.buffer),
          };
  
          const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: "id, name, mimeType, size",
          });
  
          updatedFiles.push({
            fileId: response.data.id,
            fileName: response.data.name,
            mimeType: response.data.mimeType,
            size: response.data.size,
          });
        }
      }
  
      // Cập nhật danh sách file
      existingDocument.files = updatedFiles;
  
      await existingDocument.save();
  
      res.status(200).json({
        message: "Document updated successfully!",
        document: existingDocument,
      });
    } catch (error) {
      console.error("Error in updateDocument:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Error updating document", error: error.message });
      }
    }
}
  
const getDocumentsBySentBy = async (req, res) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 10 } = req.query;
  
      const pageNumber = parseInt(page);
      const pageSize = parseInt(limit);
  
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "userId is required",
        });
      }
  
      const documents = await Document.find({ sentBy: userId })
        .populate("docVariant")
        .populate("signer", "name email")
        .populate("position", "positionName")
        .populate("departments", "departmentName")
        .populate("executors.executorId", "name")
        .populate("assignedToUsers.userId", "name email")
        .populate("sentBy", "name")
        .populate("unit", "unitName")
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize);
  
      const totalDocuments = await Document.countDocuments({ sentBy: userId });
      const totalPages = Math.ceil(totalDocuments / pageSize);
  
      res.status(200).json({
        success: true,
        currentPage: pageNumber,
        totalPages,
        totalDocuments,
        data: documents,
      });
    } catch (error) {
      console.error("Error fetching documents by sentBy:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching documents",
        error: error.message,
      });
    }
};
const getDocumentsByAssignedTo = async (req, res) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 10 } = req.query;
  
      const pageNumber = parseInt(page);
      const pageSize = parseInt(limit);
  
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "userId is required",
        });
      }
  
      const documents = await Document.find({ "assignedToUsers.userId": userId })
        .populate("docVariant")
        .populate("signer", "name email")
        .populate("position", "positionName")
        .populate("departments", "departmentName")
        .populate("executors.executorId", "name")
        .populate("assignedToUsers.userId", "name email")
        .populate("sentBy", "name")
        .populate("unit", "unitName")
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize);
  
      const totalDocuments = await Document.countDocuments({ "assignedToUsers.userId": userId });
      const totalPages = Math.ceil(totalDocuments / pageSize);
  
      res.status(200).json({
        success: true,
        currentPage: pageNumber,
        totalPages,
        totalDocuments,
        data: documents,
      });
    } catch (error) {
      console.error("Error fetching documents by assignedTo:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching documents",
        error: error.message,
      });
    }
};

const getTotalDocNum = async (req, res) => {
    try {
        const { docVariantId , year } = req.params; // Nhận docType và year từ params

        if (!docVariantId || !year) {
            return res.status(400).json({ message: "docVariantId or year are required" });
        }

        const totalDocuments = await Document.countDocuments({ docType: "received" ,docVariant: docVariantId, year });
        const totalNum = totalDocuments + 1; // Tính tổng số tài liệu
        res.status(200).json({
            success: true,
            totalNum,
        });
    } catch (error) {
        console.error("Error fetching total document number:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching total document number",
            error: error.message,
        });
    }
}



const getDeadlineStatusCounts = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid or missing userId" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const documents = await Document.find({
      "assignedToUsers.userId": new mongoose.Types.ObjectId(userId),
      deadlineDay: { $ne: null }
    });

    let soonCount = 0;
    let dueTodayCount = 0;
    let overdueCount = 0;

    documents.forEach(doc => {
      // Chỉ xử lý nếu user được giao và trạng thái onTime là "pending"
      const assigned = doc.assignedToUsers.find(
        a => a.userId.toString() === userId && a.onTime === "pending"
      );

      if (!assigned) return;

      const deadline = new Date(doc.deadlineDay);
      deadline.setHours(0, 0, 0, 0);

      const diffInDays = Math.floor((deadline - today) / (1000 * 60 * 60 * 24));

      if (diffInDays <= 2 && diffInDays > 0) {
        soonCount++;
      } else if (diffInDays === 0) {
        dueTodayCount++;
      } else if (diffInDays < 0) {
        overdueCount++;
      }
    });

    return res.json({
      soonCount,
      dueTodayCount,
      overdueCount
    });
  } catch (error) {
    console.error("Error fetching deadline counts:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


function escapeRegex(text = "") {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const searchDocuments = async(req, res) => {
  try {
    const {
      soKyHieu, // ví dụ "63/KH-NSG"
      shortDescription,
      executors, // id hoặc danh sách id
      docType,
      docVariant, // loại văn bản
      urgency, // "normal" | "high" | "immediately"
      year,
      status, // trạng thái trong assignedToUsers: "received", "sent",...
      isRead,
      userId,
      unit,
      deadlineFrom,
      deadlineTo,
      createFrom,
      createTo,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortDir = "desc",
    } = req.query;

    const filter = {};

    // ===== Số/Ký hiệu =====
    if (soKyHieu) {
      if (soKyHieu.includes("/")) {
        // vd "63/KH-NSG"
        const [numPart, codePart] = soKyHieu.split("/");
        const num = Number(numPart);
        const codeRegex = new RegExp("^" + escapeRegex(codePart.trim()), "i");
        filter.$and = [
          { docNum: num },
          { docCode: codeRegex }
        ];
      } else if (!isNaN(Number(soKyHieu))) {
        // chỉ số
        filter.docNum = Number(soKyHieu);
      } else {
        // chỉ code
        filter.docCode = new RegExp(escapeRegex(soKyHieu), "i");
      }
    }

    // ===== Trích yếu =====
    if (shortDescription) {
      filter.shortDescription = new RegExp(escapeRegex(shortDescription), "i");
    }

    // ===== Đơn vị/Người nhận (executors) =====
    if (executors) {
      const execArr = Array.isArray(executors)
        ? executors
        : String(executors).split(",").map(s => s.trim());

      const validIds = execArr.filter(id => mongoose.isValidObjectId(id));
      if (validIds.length) {
        filter["executors.executorId"] = { $in: validIds };
      }
    }

    if (userId && mongoose.isValidObjectId(userId)) {
      const elemMatch = { userId: new mongoose.Types.ObjectId(userId) };

      // Nếu có status (vd: received, sent,...)
      if (status) {
        elemMatch.status = status;
      }

      // Nếu có isRead (true / false)
      if (typeof isRead === "string") {
        if (isRead.toLowerCase() === "true") elemMatch.isRead = true;
        else if (isRead.toLowerCase() === "false") elemMatch.isRead = false;
      }

      filter.assignedToUsers = { $elemMatch: elemMatch };
    }

    // ===== Nếu có docType riêng (ngoài user) =====
    if (docType && ["sent", "received"].includes(docType)) {
      filter.docType = docType;
    }
    // ===== Biến thể văn bản (docVariant: ObjectId) =====
    if (docVariant && mongoose.isValidObjectId(docVariant)) {
      filter.docVariant = docVariant;
    }
    
    if (unit) {
      const unitArr = String(unit).split(",").map(u => u.trim());
      const validUnits = unitArr.filter(u => mongoose.isValidObjectId(u));
      if (validUnits.length) {
        filter.unit = { $in: validUnits };
      }
    }

    // ===== Mức độ khẩn (urgency: "normal" | "high" | "immediately") =====
    if (urgency && ["normal", "high", "immediately"].includes(urgency)) {
      filter.urgency = urgency;
    }
    // ===== Năm VB =====
    if (year) {
      filter.year = String(year);
    }

    // ===== Ngày hạn xử lý =====
    if (deadlineFrom || deadlineTo) {
      filter.deadlineDay = {};
      if (deadlineFrom) filter.deadlineDay.$gte = new Date(deadlineFrom);
      if (deadlineTo) filter.deadlineDay.$lte = new Date(deadlineTo);
    }

    // ===== Ngày văn bản (createAt) =====
    if (createFrom || createTo) {
      filter.createAt = {};
      if (createFrom) filter.createAt.$gte = new Date(createFrom);
      if (createTo) filter.createAt.$lte = new Date(createTo);
    }

    // ===== Pagination & Sort =====
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortDir === "desc" ? -1 : 1 };

    const [items, total] = await Promise.all([
      Document.find(filter)
        .populate("docVariant", "unit")
        .sort(sort)
        .skip(Number(skip))
        .limit(Number(limit))
        .lean(),
      Document.countDocuments(filter),
    ]);

    return res.json({
      ok: true,
      total,
      page: Number(page),
      limit: Number(limit),
      items,
    });
  } catch (err) {
    console.error("searchDocuments error", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}


module.exports = { 
    uploadToDrive,
    getAllDocuments,
    getNextDocNum,
    // getDocumentsByType,
    getDocumentsByUserAndType,
    getFilteredDocuments,
    deleteDocument,
    updateDocument,
    getDocumentById,
    isRead,
    getDocumentsBySentBy,
    getDocumentsByAssignedTo,
    getTotalDocNum,
    getDeadlineStatusCounts,
    searchDocuments
 };
