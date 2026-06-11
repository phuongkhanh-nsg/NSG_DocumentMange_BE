const mongoose = require("mongoose");

const docVariantSchema = new mongoose.Schema({

    docVariantName:{
        type:String,
        required: [true, "Variant Name is required"]
    }
},
    {
        timestamps:true,
    }
)
const DocVariant = mongoose.model("DocVariant",docVariantSchema)
module.exports = DocVariant