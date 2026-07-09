const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { Resend } = require("resend");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const resend = new Resend(process.env.RESEND_API_KEY);
const otpStore = {};

// Register
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ success: false, message: "This Email is already registered." });
    const user = await User.create({ fullName, email, phone, password });
    res.status(201).json({
      success: true,
      message: "Account created successfully!",
      token: generateToken(user._id),
      user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(400).json({ success: false, message: "Invalid email or password." });
    }
    res.json({
      success: true,
      token: generateToken(user._id),
      user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin setup
router.post("/setup-admin", async (req, res) => {
  try {
    const { fullName, email, phone, password, setupKey } = req.body;
    if (setupKey !== process.env.ADMIN_SETUP_KEY) {
      return res.status(403).json({ success: false, message: "Invalid setup key." });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ success: false, message: "This Email is already registered." });
    const admin = await User.create({ fullName, email, phone, password, role: "admin" });
    res.status(201).json({ success: true, message: "Admin account created!", user: { email: admin.email, role: admin.role } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST - Send OTP
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    console.log("OTP request for:", email);

    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: "This email is already registered." });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = { otp, expiry: Date.now() + 5 * 60 * 1000 };

    console.log("Sending OTP:", otp, "to:", email);

    const { error } = await resend.emails.send({
      from: "TrackMap Innovations <onboarding@resend.dev>",
      to: email,
      subject: "Your OTP for TrackMap Registration",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0d1424; color: #f1f5f9; border-radius: 16px;">
          <h2 style="color: #06b6d4; margin-bottom: 8px;">TrackMap Innovations</h2>
          <p style="color: #94a3b8; margin-bottom: 24px;">Your OTP for registration</p>
          <div style="background: #111827; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <p style="font-size: 2.5rem; font-weight: 800; letter-spacing: 0.2em; color: #06b6d4; margin: 0;">${otp}</p>
          </div>
          <p style="color: #94a3b8; font-size: 0.85rem;">Valid for <strong style="color: #f1f5f9;">5 minutes</strong>. Do not share.</p>
          <p style="color: #64748b; font-size: 0.78rem; margin-top: 16px;">TrackMap Innovations Pvt. Ltd. | DPIIT: DIPP229619</p>
        </div>
      `
    });

    if (error) {
      console.error("Resend Error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }

    console.log("OTP sent successfully to:", email);
    res.json({ success: true, message: "OTP sent successfully!" });
  } catch (err) {
    console.error("OTP Send Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST - Verify OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    console.log("Verifying OTP for:", email);

    const record = otpStore[email];
    if (!record) return res.status(400).json({ success: false, message: "OTP not found. Please request again." });
    if (Date.now() > record.expiry) {
      delete otpStore[email];
      return res.status(400).json({ success: false, message: "OTP expired. Please request again." });
    }
    if (record.otp !== otp) return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });

    delete otpStore[email];
    console.log("OTP verified for:", email);
    res.json({ success: true, message: "OTP verified successfully!" });
  } catch (err) {
    console.error("OTP Verify Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
