const express = require("express");
const { getDB } = require("../db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// GET /api/dashboard/stats
router.get("/stats", authenticateToken, (req, res) => {
  const db = getDB();
  const cid = req.user.company_id;

  let stats;
  if (req.user.role === "employee") {
    stats = {
      total_expenses: db
        .prepare(
          "SELECT COALESCE(SUM(total_amount),0) as val FROM expenses WHERE submitted_by = ?",
        )
        .get(req.user.id).val,
      pending_count: db
        .prepare(
          "SELECT COUNT(*) as val FROM expenses WHERE submitted_by = ? AND status IN ('pending','in_review')",
        )
        .get(req.user.id).val,
      approved_amount: db
        .prepare(
          "SELECT COALESCE(SUM(total_amount),0) as val FROM expenses WHERE submitted_by = ? AND status = 'approved'",
        )
        .get(req.user.id).val,
      rejected_count: db
        .prepare(
          "SELECT COUNT(*) as val FROM expenses WHERE submitted_by = ? AND status = 'rejected'",
        )
        .get(req.user.id).val,
      recent: db
        .prepare(
          "SELECT * FROM expenses WHERE submitted_by = ? ORDER BY created_at DESC LIMIT 5",
        )
        .all(req.user.id),
    };
  } else {
    const totalExpenses = db
      .prepare(
        "SELECT COALESCE(SUM(total_amount),0) as val FROM expenses WHERE company_id = ?",
      )
      .get(cid).val;
    const pendingCount = db
      .prepare(
        "SELECT COUNT(*) as val FROM expenses WHERE company_id = ? AND status IN ('pending','in_review')",
      )
      .get(cid).val;
    const approvedAmount = db
      .prepare(
        "SELECT COALESCE(SUM(total_amount),0) as val FROM expenses WHERE company_id = ? AND status = 'approved'",
      )
      .get(cid).val;
    const totalCount = db
      .prepare("SELECT COUNT(*) as val FROM expenses WHERE company_id = ?")
      .get(cid).val;
    const rejectedCount = db
      .prepare(
        "SELECT COUNT(*) as val FROM expenses WHERE company_id = ? AND status = 'rejected'",
      )
      .get(cid).val;
    const rejectionRate =
      totalCount.val > 0
        ? Math.round((rejectedCount.val / totalCount.val) * 100)
        : 0;

    const pendingApprovals = db
      .prepare(
        `
      SELECT COUNT(*) as val FROM approval_steps s
      JOIN expenses e ON s.expense_id = e.id
      WHERE s.approver_id = ? AND s.status = 'pending' AND e.status = 'in_review'
    `,
      )
      .get(req.user.id).val;

    const categories = db
      .prepare(
        `
      SELECT category, COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
      FROM expenses WHERE company_id = ? GROUP BY category
    `,
      )
      .all(cid);

    // Get budget limits for each category
    const budgets = db
      .prepare(
        "SELECT category, monthly_limit, is_active FROM category_budgets WHERE company_id = ? AND is_active = 1",
      )
      .all(cid);
    const budgetMap = {};
    budgets.forEach((b) => {
      budgetMap[b.category] = b.monthly_limit;
    });

    // Current month spending per category
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlySpending = db
      .prepare(
        `
      SELECT category, COALESCE(SUM(total_amount), 0) as spent
      FROM expenses WHERE company_id = ? AND strftime('%Y-%m', created_at) = ? AND status != 'rejected'
      GROUP BY category
    `,
      )
      .all(cid, currentMonth);
    const monthlyMap = {};
    monthlySpending.forEach((s) => {
      monthlyMap[s.category] = s.spent;
    });

    // Merge budget info with categories
    const categoriesWithBudget = categories.map((c) => ({
      ...c,
      monthly_limit: budgetMap[c.category] || null,
      month_spent: monthlyMap[c.category] || 0,
      remaining: budgetMap[c.category]
        ? budgetMap[c.category] - (monthlyMap[c.category] || 0)
        : null,
      utilization: budgetMap[c.category]
        ? Math.round(
            ((monthlyMap[c.category] || 0) / budgetMap[c.category]) * 100,
          )
        : null,
    }));

    const recent = db
      .prepare(
        `
      SELECT e.*, u.full_name as submitter_name, u.avatar_color as submitter_color
      FROM expenses e JOIN users u ON e.submitted_by = u.id
      WHERE e.company_id = ? ORDER BY e.created_at DESC LIMIT 10
    `,
      )
      .all(cid);

    const monthlyTrend = db
      .prepare(
        `
      SELECT strftime('%Y-%m', created_at) as month, 
             COALESCE(SUM(total_amount),0) as total,
             COUNT(*) as count
      FROM expenses WHERE company_id = ?
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month DESC LIMIT 6
    `,
      )
      .all(cid);

    // Total budget vs total spent this month
    const totalBudget = budgets.reduce((s, b) => s + b.monthly_limit, 0);
    const totalMonthSpent = monthlySpending.reduce((s, m) => s + m.spent, 0);

    stats = {
      total_expenses: totalExpenses,
      pending_count: pendingCount,
      pending_approvals: pendingApprovals,
      approved_amount: approvedAmount,
      rejection_rate: rejectionRate,
      categories: categoriesWithBudget,
      recent,
      monthly_trend: monthlyTrend,
      budget_summary: {
        total_budget: totalBudget,
        total_spent: totalMonthSpent,
        total_remaining: totalBudget - totalMonthSpent,
        overall_utilization:
          totalBudget > 0
            ? Math.round((totalMonthSpent / totalBudget) * 100)
            : 0,
      },
    };
  }

  res.json(stats);
});

module.exports = router;
