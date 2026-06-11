const mongoose = require("mongoose");

const replySchema = new mongoose.Schema(
  {
    replyBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected","inReview", "rejectedByReviewer", "approvedByReviewer"],
      default: "pending"
    },
    intendedRecipient: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      }
    ],    
    representFor: [
      {
        representForId: { type: mongoose.Schema.Types.ObjectId, required: true },
        representForType: {
          type: String,
          enum: ["User", "Department"],
          required: true
        }
      }
    ],
    docVariant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DocVariant",
      required: true
    },
    repliedDoc: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
    },
    shortDescription: {
      type: String,
      required: true
    },
    replyAt: {
      type: Date,
      default: Date.now
    },
    rejectionReason: {
      type: String
    },
    files: [
      {
        fileId: {
          type: String, 
          required: true,
        },
        fileName: {
          type: String,
        },
        mimeType: {
          type: String,
        },
        uploadDate: {
          type: Date,
          default: Date.now,
        },
      }
    ],
    action: {
      type: String,
      enum: ["rejected", "approved","inReview", "rejectedByReviewer", "approvedByReviewer"],
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewerNotes: {
      type: String,
    },
    reviewTime: {
      type: Date
    },
    reviewRejectionTime: {
      type: Date
    },
    approvalTime: {
      type: Date
    },
    rejectionTime: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

const Document = require("./document.model");
const User = require("./user.model");

replySchema.pre("save", async function (next) {
  try {
    // Xử lý thời gian duyệt hoặc từ chối
    if (this.isModified("action") && this.action) {
      if (this.action === "approved") {
        this.approvalTime = new Date();
        this.rejectionTime = undefined;
      } else if (this.action === "rejected") {
        if (!this.rejectionReason) {
          return next(new Error("Rejection reason is required when action is 'rejected'"));
        }
        this.rejectionTime = new Date();
        this.approvalTime = undefined;
      }
    }

    // Chỉ chạy cập nhật trạng thái nếu được duyệt
    if (this.action !== "approved" || !this.repliedDoc) {
      return next();
    }

    // Lấy document gốc và kiểm tra deadline
    const mainDoc = await Document.findById(this.repliedDoc).select("assignedToUsers deadlineDay");
    if (!mainDoc || !mainDoc.deadlineDay) return next();

    const replyAt = new Date(this.replyAt);
    const deadline = new Date(mainDoc.deadlineDay);

    // Hàm chỉ so sánh phần ngày
    const toDateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const replyDay = toDateOnly(replyAt);
    const deadlineDay = toDateOnly(deadline);

    let onTimeStatus = "soon";
    if (replyDay.getTime() === deadlineDay.getTime()) {
      onTimeStatus = "onTime";
    } else if (replyDay.getTime() > deadlineDay.getTime()) {
      onTimeStatus = "late";
    }

    // Cập nhật cho từng đại diện
    for (const item of this.representFor) {
      if (item.representForType === "User") {
        await Document.updateOne(
          {
            _id: this.repliedDoc,
            "assignedToUsers.userId": item.representForId,
          },
          {
            $set: {
              "assignedToUsers.$.onTime": onTimeStatus,
              "assignedToUsers.$.receivedDate": replyAt,
            },
          }
        );
      } else if (item.representForType === "Department") {
        const usersInDept = await User.find({ department: item.representForId }).select("_id");
        for (const user of usersInDept) {
          await Document.updateOne(
            {
              _id: this.repliedDoc,
              "assignedToUsers.userId": user._id,
            },
            {
              $set: {
                "assignedToUsers.$.onTime": onTimeStatus,
                "assignedToUsers.$.receivedDate": replyAt,
              },
            }
          );
        }
      }
    }

    next();
  } catch (error) {
    console.error("❌ Error in pre-save middleware:", error);
    next(error);
  }
});




const RepliedDoc = mongoose.model("RepliedDoc", replySchema);
module.exports = RepliedDoc;
