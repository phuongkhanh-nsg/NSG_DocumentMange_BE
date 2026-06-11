const express = require('express');
require('dotenv').config();
const path = require('path');
const app = express();
const port = process.env.PORT || 8888;
const hostname = process.env.HOST_NAME;

const connection = require('./src/config/db');
const mongoose = require('mongoose');
const cookieParser = require("cookie-parser");  
const cors = require("cors");

app.use(express.json({ limit: '1000mb' }));
app.use(express.urlencoded({ extended: true, limit: '1000mb' }));


// Static file configuration
// app.use(express.static(path.join(__dirname, 'public')));

// Cookie parser middleware
app.use(cookieParser());

const corsOptions = {
    origin: ["http://localhost:5173" , "https://nsg-document-mange-fe.vercel.app",],
    methods: ["GET", "POST", "PUT", "DELETE","PATCH"],
    credentials: true, // Allow sending cookies
};
app.use(cors(corsOptions));

const authRoutes = require("./src/routes/authRoutes");
const departmentRoutes = require("./src/routes/departmentRoutes");
const positionRoutes = require("./src/routes/positionRoutes");
const uploadRoutes = require("./src/routes/uploadFile");
const docVariantRoutes = require("./src/routes/docVariantRoutes")
const replyDocRoutes = require("./src/routes/repliedDocRoutes");
const unitRoutes = require("./src/routes/unitRoutes");
const chartRoutes = require("./src/routes/chartRoutes")
const exportDocumentsToExcel =require('./src/routes/exportFile.Controller')
const statisticRoutes = require('./src/routes/statisticRoutes')
const googleRoutes = require('./src/routes/googleRouutes')

app.use('/authen', authRoutes);
app.use('/departments',departmentRoutes);
app.use('/positions', positionRoutes);
app.use('/documents',uploadRoutes);
app.use('/docVariants',docVariantRoutes);
app.use('/replyDoc',replyDocRoutes);
app.use('/units',unitRoutes);
app.use('/charts',chartRoutes);
app.use('/exports', exportDocumentsToExcel)
app.use('/statistics', statisticRoutes)
app.use('/google', googleRoutes);



app.get("/test", (req, res) => {
  res.json({message: "Hello World! Backend is online successfully (28/04)."});
});

(async () => {
    try {
      await connection();
      if (process.env.NODE_ENV !== 'production') {
        app.listen(port, () => {
          console.log(`Ứng dụng mẫu đang nghe trên cổng http://localhost:${port}`);
        });
      }
    } catch (error) {
      console.log(">>> lỗi kết nối đến db", error);
    }
})();

module.exports = app;