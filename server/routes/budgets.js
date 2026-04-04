const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { getDB } = require("../db");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/budgets - list all category budgets for the company
router.get("/", authenticateToken, (req, res) => {
  const db = getDB();
  const budgets = db
    .prepare(
      "SELECT * FROM category_budgets WHERE company_id = ? ORDER BY category",
    )
    .all(req.user.company_id);

  // Get current month's spending per category
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const spending = db
    .prepare(
      `
    SELECT category, COALESCE(SUM(total_amount), 0) as spent, COUNT(*) as count
    FROM expenses
    WHERE company_id = ? AND strftime('%Y-%m', created_at) = ? AND status != 'rejected'
    GROUP BY category
  `,
    )
    .all(req.user.company_id, currentMonth);

  const spendingMap = {};
  spending.forEach((s) => {
    spendingMap[s.category] = { spent: s.spent, count: s.count };
  });

  const result = budgets.map((b) => ({
    ...b,
    spent: spendingMap[b.category]?.spent || 0,
    expense_count: spendingMap[b.category]?.count || 0,
    remaining: b.monthly_limit - (spendingMap[b.category]?.spent || 0),
    utilization:
      b.monthly_limit > 0
        ? Math.round(
            ((spendingMap[b.category]?.spent || 0) / b.monthly_limit) * 100,
          )
        : 0,
  }));

  res.json(result);
});

// GET /api/budgets/check/:category - check budget availability for a category
router.get("/check/:category", authenticateToken, (req, res) => {
  const db = getDB();
  const budget = db
    .prepare(
      "SELECT * FROM category_budgets WHERE company_id = ? AND category = ? AND is_active = 1",
    )
    .get(req.user.company_id, req.params.category);

  if (!budget) {
    return res.json({ has_budget: false, unlimited: true });
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const spent = db
    .prepare(
      `
    SELECT COALESCE(SUM(total_amount), 0) as val
    FROM expenses
    WHERE company_id = ? AND category = ? AND strftime('%Y-%m', created_at) = ? AND status != 'rejected'
  `,
    )
    .get(req.user.company_id, req.params.category, currentMonth).val;

  res.json({
    has_budget: true,
    unlimited: false,
    category: budget.category,
    monthly_limit: budget.monthly_limit,
    spent,
    remaining: budget.monthly_limit - spent,
    utilization: Math.round((spent / budget.monthly_limit) * 100),
  });
});

// POST /api/budgets - create or update budget (admin only)
router.post("/", authenticateToken, requireRole("admin"), (req, res) => {
  const { category, monthly_limit } = req.body;
  if (!category || !monthly_limit || monthly_limit <= 0) {
    return res
      .status(400)
      .json({ error: "Category and a positive monthly limit are required" });
  }

  const db = getDB();

  // Upsert: update if exists, else insert
  const existing = db
    .prepare(
      "SELECT id FROM category_budgets WHERE company_id = ? AND category = ?",
    )
    .get(req.user.company_id, category);

  if (existing) {
    db.prepare(
      "UPDATE category_budgets SET monthly_limit = ?, is_active = 1, updated_at = datetime('now') WHERE id = ?",
    ).run(monthly_limit, existing.id);
    res.json({ success: true, id: existing.id, updated: true });
  } else {
    const id = uuidv4();
    db.prepare(
      "INSERT INTO category_budgets (id, company_id, category, monthly_limit) VALUES (?, ?, ?, ?)",
    ).run(id, req.user.company_id, category, monthly_limit);
    res.status(201).json({ success: true, id, created: true });
  }
});

// PUT /api/budgets/:id - update a budget
router.put("/:id", authenticateToken, requireRole("admin"), (req, res) => {
  const { monthly_limit, is_active } = req.body;
  const db = getDB();
  db.prepare(
    "UPDATE category_budgets SET monthly_limit = ?, is_active = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ?",
  ).run(monthly_limit, is_active ?? 1, req.params.id, req.user.company_id);
  res.json({ success: true });
});

// DELETE /api/budgets/:id
router.delete("/:id", authenticateToken, requireRole("admin"), (req, res) => {
  const db = getDB();
  db.prepare(
    "DELETE FROM category_budgets WHERE id = ? AND company_id = ?",
  ).run(req.params.id, req.user.company_id);
  res.json({ success: true });
});

module.exports = router;
