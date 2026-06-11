const mongoose = require("mongoose");
const Document = require("../models/document.model");

const getDocumentsStats = async (req, res) => {
  try {
    const { year, mode, userId, docType, docVariant } = req.query;

    if ((mode === "month" || mode === "quarter") && !year) {
      return res.status(400).json({ message: "Year is required for month or quarter mode." });
    }

    // Tạo điều kiện cơ bản
    const matchByYear = (year && (mode === "month" || mode === "quarter" || mode === "year")) ? { year } : undefined;


    // Tạo filter dùng chung
    const buildMatch = (type) => {
      const match = { docType: type };

      if (matchByYear) match.year = matchByYear.year;


      if (docVariant && mongoose.Types.ObjectId.isValid(docVariant)) {
        match.docVariant = new mongoose.Types.ObjectId(docVariant);
      }

      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        match["assignedToUsers.userId"] = new mongoose.Types.ObjectId(userId);
      }

      return match;
    };

    // Nếu lọc theo docType cụ thể → chỉ thống kê loại đó
    const matchTypes = docType === "sent" ? ["sent"] : docType === "received" ? ["received"] : ["sent", "received"];

    const groupField =
      mode === "month"
        ? { $month: "$createAt" }
        : mode === "quarter"
        ? { $ceil: { $divide: [{ $month: "$createAt" }, 3] } }
        : { $year: "$createAt" };

    const getAggregationPipeline = (matchConditions, groupField) => [
      { $match: matchConditions },
      {
        $group: {
          _id: groupField,
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id": 1 } },
    ];

    // Chạy các thống kê cần thiết
    let sentData = [], receivedData = [];

    if (matchTypes.includes("sent")) {
      sentData = await Document.aggregate(getAggregationPipeline(buildMatch("sent"), groupField));
    }
    if (matchTypes.includes("received")) {
      receivedData = await Document.aggregate(getAggregationPipeline(buildMatch("received"), groupField));
    }

    // Tạo mảng kết quả
    let formattedData = [];

    if (mode === "month") {
      formattedData = Array.from({ length: 12 }, (_, index) => {
        const sent = sentData.find(d => d._id === index + 1)?.count || 0;
        const received = receivedData.find(d => d._id === index + 1)?.count || 0;
        return { month: index + 1, sent, received };
      });
    } else if (mode === "quarter") {
      formattedData = Array.from({ length: 4 }, (_, index) => {
        const sent = sentData.find(d => d._id === index + 1)?.count || 0;
        const received = receivedData.find(d => d._id === index + 1)?.count || 0;
        return { quarter: index + 1, sent, received };
      });
    } else if (mode === "year") {
      const allYears = new Set([...sentData.map(d => d._id), ...receivedData.map(d => d._id)]);
      formattedData = Array.from(allYears).sort().map(year => {
        const sent = sentData.find(d => d._id === year)?.count || 0;
        const received = receivedData.find(d => d._id === year)?.count || 0;
        return { year, sent, received };
      });
    }

    res.json(formattedData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getDocumentsStatusStats = async (req, res) => {
  try {
    const { year, mode, userId, docVariant } = req.query;

    if ((mode === "month" || mode === "quarter") && !year) {
      return res.status(400).json({ message: "Year is required for month or quarter mode." });
    }

    const matchByYear =
      year && (mode === "month" || mode === "quarter" || mode === "year")
        ? { year } // vì year trong DB là String
        : {};

    const buildMatch = (type) => {
      const match = { docType: type, ...matchByYear };

      if (docVariant && mongoose.Types.ObjectId.isValid(docVariant)) {
        match.docVariant = new mongoose.Types.ObjectId(docVariant);
      }

      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        match["assignedToUsers.userId"] = new mongoose.Types.ObjectId(userId);
      }

      return match;
    };

    const groupField =
      mode === "month"
        ? { $month: "$createAt" }
        : mode === "quarter"
        ? { $ceil: { $divide: [{ $month: "$createAt" }, 3] } }
        : { $year: "$createAt" };

    // Chỉ thực hiện thống kê cho văn bản đến
    const documents = await Document.aggregate([
      { $match: buildMatch("received") },
      { $unwind: "$assignedToUsers" },
      ...(userId && mongoose.Types.ObjectId.isValid(userId)
        ? [{ $match: { "assignedToUsers.userId": new mongoose.Types.ObjectId(userId) } }]
        : []),
      {
        $project: {
          group: groupField,
          deadlineDay: "$deadlineDay",
          onTime: "$assignedToUsers.onTime"
        }
      },
      {
        $project: {
          group: 1,
          status: {
            $cond: [
              {
                $and: [
                  { $eq: ["$onTime", "pending"] },
                  { $lt: ["$deadlineDay", new Date()] }
                ]
              },
              "unhandled",
              {
                $switch: {
                  branches: [
                    { case: { $eq: ["$onTime", "onTime"] }, then: "onTime" },
                    { case: { $eq: ["$onTime", "soon"] }, then: "soon" },
                    { case: { $eq: ["$onTime", "late"] }, then: "late" },
                    { case: { $eq: ["$onTime", "pending"] }, then: "pending" }
                  ],
                  default: "unknown"
                }
              }
            ]
          }
        }
      },
      {
        $group: {
          _id: { group: "$group", status: "$status" },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.group",
          status: {
            $push: {
              type: "$_id.status",
              count: "$count"
            }
          }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    const formatStats = (stats) => {
      return stats.map(item => {
        const result = {
          _id: item._id,
          onTime: 0,
          soon: 0,
          late: 0,
          pending: 0,
          unhandled: 0
        };
        item.status.forEach(s => {
          if (s.type in result) result[s.type] = s.count;
        });
        return result;
      });
    };

    const formatted = formatStats(documents);

    const maxGroup = mode === "month" ? 12 : mode === "quarter" ? 4 : 1;
    const timeline = Array.from({ length: maxGroup }, (_, i) => i + 1);

    const combined = timeline.map(time => {
      const received = formatted.find(d => d._id === time) || {
        onTime: 0,
        soon: 0,
        late: 0,
        pending: 0,
        unhandled: 0
      };

      const label =
        mode === "month" ? { month: time } :
        mode === "quarter" ? { quarter: time } :
        { year: year };

      return {
        ...label,
        receivedOnTime: received.onTime,
        receivedSoon: received.soon,
        receivedLate: received.late,
        receivedPending: received.pending,
        receivedUnhandled: received.unhandled
      };
    });

    res.json(combined);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { getDocumentsStats, 
                  getDocumentsStatusStats };
