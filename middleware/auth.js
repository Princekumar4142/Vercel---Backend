const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (err) {
      return res.status(401).json({ success: false, message: "Invalid Token" });
    }
  }
  if (!token) return res.status(401).json({ success: false, message: "Please login first" });
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") return next();
  res.status(403).json({ success: false, message: "Admin access required" });
};

module.exports = { protect, adminOnly };
