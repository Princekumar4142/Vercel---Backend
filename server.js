const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const connectDB = require("./config/db");

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// uploads folder auto-create
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  console.log("✅ uploads folder create ho gaya");
}

app.use("/uploads", express.static(uploadsDir));

// ✅ Certificate verify route — no auth needed
app.get("/api/verify-cert", async (req, res) => {
  try {
    const Application = require("./models/Application");
    const certId = req.query.certId;
    if (!certId) return res.status(400).json({ success: false, message: "Certificate ID required" });
    const found = await Application.findOne({ certificateId: certId, certificateIssued: true });
    if (!found) return res.status(404).json({ success: false, message: "Certificate not valid or does not exist" });
    res.json({
      success: true,
      data: {
        fullName: found.fullName, college: found.college, branch: found.branch,
        semester: found.semester, domain: found.domain,
        certificateId: found.certificateId, issuedAt: found.updatedAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/applications", require("./routes/applications"));

app.get("/", (req, res) => res.send("TrackMap V2 API Running 🚀"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));