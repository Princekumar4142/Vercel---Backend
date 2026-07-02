const express = require("express");
const router = express.Router();
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");
const Application = require("../models/Application");
const { protect, adminOnly } = require("../middleware/auth");

// Payment screenshot storage (Cloudinary)
const paymentStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "trackmap/payments",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});
const upload = multer({ storage: paymentStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// Certificate upload storage (Cloudinary)
const certStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "trackmap/certificates",
    allowed_formats: ["pdf", "jpg", "jpeg", "png"],
    resource_type: "auto",
  },
});
const uploadCert = multer({ storage: certStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// POST - New application
router.post("/", protect, async (req, res) => {
  try {
    const existing = await Application.findOne({
      user: req.user._id,
      domain: req.body.domain
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `You have already applied for "${req.body.domain}". Please choose a different domain.`
      });
    }
    const app = await Application.create({ ...req.body, user: req.user._id });
    res.status(201).json({ success: true, message: "Application submitted successfully!", data: app });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST - Payment submit
router.post("/:id/payment", protect, upload.single("screenshot"), async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: "Application not found" });
    app.utrId = req.body.utrId;
    app.paymentScreenshot = req.file ? req.file.path : "";
    app.paymentStatus = "submitted";
    await app.save();
    res.json({ success: true, message: "Payment details submitted! Verification pending." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET - My applications
router.get("/my", protect, async (req, res) => {
  try {
    const apps = await Application.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: apps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET - Certificate verify (public)
router.get("/verify", async (req, res) => {
  try {
    const certId = req.query.certId;
    if (!certId) return res.status(400).json({ success: false, message: "Certificate ID required" });
    const app = await Application.findOne({ certificateId: certId, certificateIssued: true });
    if (!app) return res.status(404).json({ success: false, message: "Certificate not valid or does not exist" });
    res.json({
      success: true,
      data: {
        fullName: app.fullName, college: app.college, branch: app.branch,
        semester: app.semester, domain: app.domain, certificateId: app.certificateId,
        issuedAt: app.updatedAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET all applications (admin)
router.get("/", protect, adminOnly, async (req, res) => {
  try {
    const apps = await Application.find().sort({ createdAt: -1 });
    res.json({ success: true, count: apps.length, data: apps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single application (admin)
router.get("/:id", protect, adminOnly, async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: app });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT - Update (admin)
router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const app = await Application.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, message: "Updated successfully", data: app });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT - Approve + issue certificate (admin)
router.put("/:id/approve", protect, adminOnly, async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: "Not found" });
    const count = await Application.countDocuments({ certificateIssued: true });
    const certId = `TMI/INT/2026/${String(count + 1).padStart(2, "0")}`;
    app.paymentStatus = "verified";
    app.status = "approved";
    app.certificateIssued = true;
    app.certificateId = certId;
    app.adminNote = req.body.adminNote || "";
    await app.save();
    res.json({ success: true, message: "Approved! Certificate ID: " + certId, data: app });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT - Upload certificate file (admin) ✅ NEW
router.put("/:id/upload-certificate", protect, adminOnly, uploadCert.single("certificate"), async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: "Application not found" });
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
    app.certificateFile = req.file.path;
    await app.save();
    res.json({ success: true, message: "Certificate uploaded successfully!", filename: req.file.path });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT - Reject (admin)
router.put("/:id/reject", protect, adminOnly, async (req, res) => {
  try {
    const app = await Application.findByIdAndUpdate(req.params.id,
      { status: "rejected", paymentStatus: "rejected", adminNote: req.body.adminNote || "" },
      { new: true }
    );
    res.json({ success: true, message: "Rejected", data: app });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE (admin)
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    await Application.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;