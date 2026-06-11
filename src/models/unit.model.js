const mongoose = require("mongoose");

const unitSchema = new mongoose.Schema({
    unitCode: {
        type:String,
        unique: true,
        required: [true, "Unit Code is required"],

    },
    unitName: {
        type:String,
        required: [true, "Unit Name is required"],
    }
},
{
    timestamps: true,
  }
)
const Unit = mongoose.model("Unit", unitSchema)
module.exports = Unit;