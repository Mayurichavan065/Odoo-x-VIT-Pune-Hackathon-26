const express = require("express");
const { getDB } = require("../db");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/users - list company users
router.get("/", authenticateToken, (req, res) => {
  const db = getDB();
  const users = db
    .prepare(
      `
    SELECT u.id, u.email, u.full_name, u.role, u.company_id, u.manager_id, u.avatar_color, u.created_at,
           m.full_name as manager_name
    FROM users u LEFT JOIN users m ON u.manager_id = m.id
    WHERE u.company_id = ?
    ORDER BY u.created_at DESC
  `,
    )
    .all(req.user.company_id);
  res.json(users);
});

// GET /api/users/managers - list managers for assignment
router.get("/managers", authenticateToken, (req, res) => {
  const db = getDB();
  const managers = db
    .prepare(
      "SELECT id, full_name, email, avatar_color FROM users WHERE company_id = ? AND role IN ('admin','manager')",
    )
    .all(req.user.company_id);
  res.json(managers);
});

// PUT /api/users/:id/role - update user role (admin only)
router.put("/:id/role", authenticateToken, requireRole("admin"), (req, res) => {
  const { role } = req.body;
  if (!["admin", "manager", "employee"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  const db = getDB();
  db.prepare("UPDATE users SET role = ? WHERE id = ? AND company_id = ?").run(
    role,
    req.params.id,
    req.user.company_id,
  );
  res.json({ success: true });
});

// PUT /api/users/:id/manager - assign manager (admin only)
router.put(
  "/:id/manager",
  authenticateToken,
  requireRole("admin"),
  (req, res) => {
    const { manager_id } = req.body;
    const db = getDB();
    db.prepare(
      "UPDATE users SET manager_id = ? WHERE id = ? AND company_id = ?",
    ).run(manager_id || null, req.params.id, req.user.company_id);
    res.json({ success: true });
  },
);

module.exports = router;
