const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");


const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

// Register
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email address." });
    }

    // Phone validation
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ success: false, message: "Invalid phone number. Must be 10 digits starting with 6-9." });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ success: false, message: "This email is already registered." });

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
    if (exists) return res.status(400).json({ success: false, message: "This email is already registered." });
    const admin = await User.create({ fullName, email, phone, password, role: "admin" });
    res.status(201).json({ success: true, message: "Admin account created!", user: { email: admin.email, role: admin.role } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const nodemailer = require("nodemailer");
const otpStore = {}; // temporary OTP storage

// Transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  family: 4,   // IPv4 force karega, IPv6 ENETUNREACH fix karega
});

// POST - Send OTP
router.post("/send-otp", async (req, res) => {
  try {
  
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    // Check if email already registered
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: "This email is already registered." });

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP with 5 min expiry
    otpStore[email] = { otp, expiry: Date.now() + 5 * 60 * 1000 };

    // Send email
    await transporter.sendMail({
      from: `"TrackMap Innovations" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP for TrackMap Registration",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0d1424; color: #f1f5f9; border-radius: 16px;">
          <h2 style="color: #06b6d4; margin-bottom: 8px;">TrackMap Innovations</h2>
          <p style="color: #94a3b8; margin-bottom: 24px;">Your OTP for registration</p>
          <div style="background: #111827; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <p style="font-size: 2.5rem; font-weight: 800; letter-spacing: 0.2em; color: #06b6d4; margin: 0;">${otp}</p>
          </div>
          <p style="color: #94a3b8; font-size: 0.85rem;">This OTP is valid for <strong style="color: #f1f5f9;">5 minutes</strong>. Do not share it with anyone.</p>
          <p style="color: #64748b; font-size: 0.78rem; margin-top: 16px;">TrackMap Innovations Pvt. Ltd. | DPIIT: DIPP229619</p>
        </div>
      `,
    });

    res.json({ success: true, message: "OTP sent successfully!" });
  } 
  catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST - Verify OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const record = otpStore[email];

    if (!record) return res.status(400).json({ success: false, message: "OTP not found. Please request again." });
    if (Date.now() > record.expiry) {
      delete otpStore[email];
      return res.status(400).json({ success: false, message: "OTP expired. Please request again." });
    }
    if (record.otp !== otp) return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });

    delete otpStore[email];
    res.json({ success: true, message: "OTP verified successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
