const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { getDB } = require("../db");
const { generateToken, authenticateToken } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { email, password, full_name, role, company_name } = req.body;
    if (!email || !password || !full_name || !role || !company_name) {
      return res.status(400).json({ error: "All fields are required" });
    }
    const db = getDB();
    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email);
    if (existing)
      return res.status(409).json({ error: "Email already registered" });

    // Auto-create company
    let company = db
      .prepare("SELECT id FROM companies WHERE name = ?")
      .get(company_name);
    let company_id;
    if (!company) {
      company_id = uuidv4();
      db.prepare("INSERT INTO companies (id, name) VALUES (?, ?)").run(
        company_id,
        company_name,
      );
    } else {
      company_id = company.id;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const colors = [
      "#6366F1",
      "#10B981",
      "#F59E0B",
      "#EF4444",
      "#8B5CF6",
      "#EC4899",
      "#06B6D4",
      "#F97316",
    ];
    const avatar_color = colors[Math.floor(Math.random() * colors.length)];

    db.prepare(
      "INSERT INTO users (id, email, password, full_name, role, company_id, avatar_color) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(
      userId,
      email,
      hashedPassword,
      full_name,
      role,
      company_id,
      avatar_color,
    );

    const user = db
      .prepare(
        "SELECT id, email, full_name, role, company_id, avatar_color FROM users WHERE id = ?",
      )
      .get(userId);
    const token = generateToken(user);

    res.status(201).json({ token, user: { ...user, company_name } });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Server error during signup" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const db = getDB();
    const user = db
      .prepare(
        `
      SELECT u.*, c.name as company_name FROM users u
      JOIN companies c ON u.company_id = c.id
      WHERE u.email = ?
    `,
      )
      .get(email);

    if (!user)
      return res
        .status(200)
        .json({ success: false, error: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res
        .status(200)
        .json({ success: false, error: "Invalid email or password" });

    const token = generateToken(user);
    const { password: _, ...userWithoutPassword } = user;
    res.json({ success: true, token, user: userWithoutPassword });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const db = getDB();
    const user = db
      .prepare("SELECT id, email, full_name FROM users WHERE email = ?")
      .get(email);

    if (!user) {
      return res
        .status(200)
        .json({
          success: true,
          message:
            "If an account exists with this email, a reset code has been sent.",
        });
    }

    // Invalidate any existing unused OTPs for this user
    db.prepare(
      "UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0",
    ).run(user.id);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const resetId = uuidv4();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    db.prepare(
      "INSERT INTO password_resets (id, user_id, otp, expires_at) VALUES (?, ?, ?, ?)",
    ).run(resetId, user.id, otp, expiresAt);

    console.log(`\n  📧 Password Reset OTP for ${user.email}: ${otp}\n`);

    res.json({
      success: true,
      message: "A 6-digit reset code has been sent to your email.",
      // In production, remove the OTP from the response — only sent via email
      _dev_otp: otp,
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password) {
      return res
        .status(400)
        .json({ error: "Email, OTP, and new password are required" });
    }

    if (new_password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const db = getDB();
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (!user) return res.status(400).json({ error: "Invalid reset request" });

    const resetRecord = db
      .prepare(
        "SELECT * FROM password_resets WHERE user_id = ? AND otp = ? AND used = 0 ORDER BY created_at DESC LIMIT 1",
      )
      .get(user.id, otp);

    if (!resetRecord) {
      return res.status(400).json({ error: "Invalid or expired reset code" });
    }

    // Check expiration
    if (new Date(resetRecord.expires_at) < new Date()) {
      db.prepare("UPDATE password_resets SET used = 1 WHERE id = ?").run(
        resetRecord.id,
      );
      return res
        .status(400)
        .json({ error: "Reset code has expired. Please request a new one." });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(new_password, 10);
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(
      hashedPassword,
      user.id,
    );

    // Mark OTP as used
    db.prepare("UPDATE password_resets SET used = 1 WHERE id = ?").run(
      resetRecord.id,
    );

    res.json({
      success: true,
      message: "Password has been reset successfully. You can now sign in.",
    });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/auth/me
router.get("/me", authenticateToken, (req, res) => {
  const db = getDB();
  const user = db
    .prepare(
      `
    SELECT u.id, u.email, u.full_name, u.role, u.company_id, u.avatar_color, u.manager_id,
           c.name as company_name, c.base_currency
    FROM users u JOIN companies c ON u.company_id = c.id
    WHERE u.id = ?
  `,
    )
    .get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

module.exports = router;
