const express = require("express");
const { getDB } = require("../db");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/approvals/pending - get my pending approvals
router.get(
  "/pending",
  authenticateToken,
  requireRole("admin", "manager"),
  (req, res) => {
    const db = getDB();
    const pendingSteps = db
      .prepare(
        `
    SELECT s.*, e.title, e.total_amount, e.currency, e.category, e.status as expense_status,
           e.submitted_at, e.receipt_path,
           u.full_name as submitter_name, u.avatar_color as submitter_color
    FROM approval_steps s
    JOIN expenses e ON s.expense_id = e.id
    JOIN users u ON e.submitted_by = u.id
    WHERE s.approver_id = ? AND s.status = 'pending' AND e.status = 'in_review'
    ORDER BY e.submitted_at DESC
  `,
      )
      .all(req.user.id);
    res.json(pendingSteps);
  },
);

// POST /api/approvals/:stepId/decide
router.post("/:stepId/decide", authenticateToken, (req, res) => {
  const { decision, comment } = req.body;
  if (!["approved", "rejected"].includes(decision)) {
    return res
      .status(400)
      .json({ error: "Decision must be approved or rejected" });
  }

  const db = getDB();
  const step = db
    .prepare(
      `
    SELECT s.*, e.company_id, e.total_amount FROM approval_steps s
    JOIN expenses e ON s.expense_id = e.id
    WHERE s.id = ? AND s.approver_id = ?
  `,
    )
    .get(req.params.stepId, req.user.id);

  if (!step) return res.status(404).json({ error: "Approval step not found" });
  if (step.status !== "pending")
    return res.status(400).json({ error: "Step already decided" });

  const transaction = db.transaction(() => {
    // Update the step
    db.prepare(
      "UPDATE approval_steps SET status = ?, comment = ?, decided_at = datetime('now') WHERE id = ?",
    ).run(decision, comment || "", req.params.stepId);

    if (decision === "rejected") {
      // Reject the entire expense
      db.prepare(
        "UPDATE expenses SET status = 'rejected', updated_at = datetime('now') WHERE id = ?",
      ).run(step.expense_id);
      // Skip remaining steps
      db.prepare(
        "UPDATE approval_steps SET status = 'skipped' WHERE expense_id = ? AND step_order > ?",
      ).run(step.expense_id, step.step_order);
    } else {
      // Check conditional rules
      evaluateConditionalRules(
        db,
        step.expense_id,
        step.company_id,
        step.total_amount,
      );

      // Check if more steps
      const nextStep = db
        .prepare(
          "SELECT id FROM approval_steps WHERE expense_id = ? AND step_order > ? AND status = 'pending' LIMIT 1",
        )
        .get(step.expense_id, step.step_order);

      if (!nextStep) {
        db.prepare(
          "UPDATE expenses SET status = 'approved', updated_at = datetime('now') WHERE id = ?",
        ).run(step.expense_id);
      }
    }
  });

  transaction();

  const expense = db
    .prepare("SELECT * FROM expenses WHERE id = ?")
    .get(step.expense_id);
  const steps = db
    .prepare(
      `
    SELECT s.*, u.full_name as approver_name FROM approval_steps s
    JOIN users u ON s.approver_id = u.id WHERE s.expense_id = ? ORDER BY s.step_order
  `,
    )
    .all(step.expense_id);

  res.json({ expense, approval_steps: steps });
});

function evaluateConditionalRules(db, expenseId, companyId, amount) {
  const rules = db
    .prepare(
      "SELECT * FROM approval_rules WHERE company_id = ? AND is_active = 1 ORDER BY priority",
    )
    .all(companyId);

  for (const rule of rules) {
    if (rule.rule_type === "percentage" && rule.percentage_threshold) {
      const totalSteps = db
        .prepare(
          "SELECT COUNT(*) as cnt FROM approval_steps WHERE expense_id = ?",
        )
        .get(expenseId);
      const approvedSteps = db
        .prepare(
          "SELECT COUNT(*) as cnt FROM approval_steps WHERE expense_id = ? AND status = 'approved'",
        )
        .get(expenseId);
      const pct = (approvedSteps.cnt / totalSteps.cnt) * 100;
      if (pct >= rule.percentage_threshold) {
        db.prepare(
          "UPDATE approval_steps SET status = 'skipped' WHERE expense_id = ? AND status = 'pending'",
        ).run(expenseId);
        db.prepare(
          "UPDATE expenses SET status = 'approved', updated_at = datetime('now') WHERE id = ?",
        ).run(expenseId);
        return;
      }
    }

    if (
      rule.rule_type === "hybrid" &&
      rule.auto_approve_below &&
      amount <= rule.auto_approve_below
    ) {
      db.prepare(
        "UPDATE approval_steps SET status = 'skipped' WHERE expense_id = ? AND status = 'pending'",
      ).run(expenseId);
      db.prepare(
        "UPDATE expenses SET status = 'approved', updated_at = datetime('now') WHERE id = ?",
      ).run(expenseId);
      return;
    }
  }
}

// GET /api/approvals/history
router.get("/history", authenticateToken, (req, res) => {
  const db = getDB();
  const history = db
    .prepare(
      `
    SELECT s.*, e.title, e.total_amount, e.currency, e.category,
           u.full_name as submitter_name
    FROM approval_steps s
    JOIN expenses e ON s.expense_id = e.id
    JOIN users u ON e.submitted_by = u.id
    WHERE s.approver_id = ? AND s.status != 'pending'
    ORDER BY s.decided_at DESC
  `,
    )
    .all(req.user.id);
  res.json(history);
});

module.exports = router;
