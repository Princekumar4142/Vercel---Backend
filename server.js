const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

dotenv.config();
connectDB();

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false
}));

app.options("*", cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Certificate verify route
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

app.use("/api/auth", require("./routes/auth"));
app.use("/api/applications", require("./routes/applications"));

app.get("/", (req, res) => res.send("TrackMap V2 API Running 🚀"));

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
