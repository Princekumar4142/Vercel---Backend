const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  college: { type: String, required: true },
  branch: { type: String, required: true },
  semester: { type: String, required: true },
  regNo: { type: String, required: true },
  domain: { type: String, required: true },
  skills: { type: String, required: false },
  whyJoin: { type: String, default: "" },

  // Payment Info
  paymentStatus: {
    type: String,
    enum: ["pending", "submitted", "verified", "rejected"],
    default: "pending"
  },
  utrId: { type: String, default: "" },
  paymentScreenshot: { type: String, default: "" },

  // Application Status
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },

  // Certificate
  certificateId: { type: String, default: "" },
  certificateIssued: { type: Boolean, default: false },
  certificateFile: { type: String, default: "" }, // ✅ NEW - uploaded certificate file

  adminNote: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Application", applicationSchema);