const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/expenses - submit expense
router.post('/', authenticateToken, (req, res) => {
  const { title, description, category, currency, line_items, receipt_path, receipt_ocr_data } = req.body;
  if (!title || !category || !line_items || line_items.length === 0) {
    return res.status(400).json({ error: 'Title, category, and at least one line item required' });
  }

  const db = getDB();
  const expenseId = uuidv4();
  const total = line_items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  // Convert currency if needed
  const companyCurrency = db.prepare('SELECT base_currency FROM companies WHERE id = ?').get(req.user.company_id);
  let converted_amount = total;
  if (currency && companyCurrency && currency !== companyCurrency.base_currency) {
    const fromRate = db.prepare('SELECT rate_to_usd FROM currencies WHERE code = ?').get(currency);
    const toRate = db.prepare('SELECT rate_to_usd FROM currencies WHERE code = ?').get(companyCurrency.base_currency);
    if (fromRate && toRate) {
      converted_amount = (total / fromRate.rate_to_usd) * toRate.rate_to_usd;
    }
  }

  const insertExpense = db.prepare(`
    INSERT INTO expenses (id, title, description, total_amount, currency, converted_amount, category, status, submitted_by, company_id, receipt_path, receipt_ocr_data, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, datetime('now'))
  `);

  const insertLine = db.prepare(
    'INSERT INTO expense_lines (id, expense_id, description, amount, category, date) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const transaction = db.transaction(() => {
    insertExpense.run(expenseId, title, description || '', total, currency || 'INR', converted_amount, category, req.user.id, req.user.company_id, receipt_path || null, receipt_ocr_data || null);

    for (const item of line_items) {
      insertLine.run(uuidv4(), expenseId, item.description, parseFloat(item.amount), item.category || category, item.date || null);
    }

    // Auto-create approval workflow
    createApprovalWorkflow(db, expenseId, req.user.id, req.user.company_id, total);
  });

  transaction();
  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId);
  const lines = db.prepare('SELECT * FROM expense_lines WHERE expense_id = ?').all(expenseId);
  const steps = db.prepare('SELECT s.*, u.full_name as approver_name FROM approval_steps s JOIN users u ON s.approver_id = u.id WHERE s.expense_id = ? ORDER BY s.step_order').all(expenseId);

  res.status(201).json({ ...expense, line_items: lines, approval_steps: steps });
});

function createApprovalWorkflow(db, expenseId, submitterId, companyId, amount) {
  // Check for auto-approve rules first
  const autoRule = db.prepare(
    "SELECT * FROM approval_rules WHERE company_id = ? AND rule_type = 'auto_approve' AND is_active = 1 AND auto_approve_below >= ? ORDER BY priority"
  ).get(companyId, amount);

  if (autoRule) {
    db.prepare("UPDATE expenses SET status = 'approved' WHERE id = ?").run(expenseId);
    return;
  }

  // Get submitter's manager
  const submitter = db.prepare('SELECT manager_id FROM users WHERE id = ?').get(submitterId);
  let stepOrder = 1;

  if (submitter && submitter.manager_id) {
    db.prepare(
      'INSERT INTO approval_steps (id, expense_id, step_order, approver_id) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), expenseId, stepOrder++, submitter.manager_id);
  }

  // Add admin approvers for amounts over threshold
  const admins = db.prepare(
    "SELECT id FROM users WHERE company_id = ? AND role = 'admin' AND id != ? LIMIT 1"
  ).all(companyId, submitterId);

  if (amount > 25000 && admins.length > 0) {
    db.prepare(
      'INSERT INTO approval_steps (id, expense_id, step_order, approver_id) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), expenseId, stepOrder++, admins[0].id);
  }

  // If no approvers found, auto-set to in_review
  if (stepOrder === 1) {
    const anyAdmin = db.prepare(
      "SELECT id FROM users WHERE company_id = ? AND role = 'admin' LIMIT 1"
    ).get(companyId);
    if (anyAdmin) {
      db.prepare(
        'INSERT INTO approval_steps (id, expense_id, step_order, approver_id) VALUES (?, ?, ?, ?)'
      ).run(uuidv4(), expenseId, 1, anyAdmin.id);
    }
  }

  db.prepare("UPDATE expenses SET status = 'in_review' WHERE id = ?").run(expenseId);
}

// GET /api/expenses - my expenses
router.get('/', authenticateToken, (req, res) => {
  const db = getDB();
  const { status, category, search } = req.query;
  let query = 'SELECT e.*, u.full_name as submitter_name FROM expenses e JOIN users u ON e.submitted_by = u.id WHERE e.submitted_by = ?';
  const params = [req.user.id];

  if (status && status !== 'all') { query += ' AND e.status = ?'; params.push(status); }
  if (category && category !== 'all') { query += ' AND e.category = ?'; params.push(category); }
  if (search) { query += ' AND (e.title LIKE ? OR e.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  query += ' ORDER BY e.created_at DESC';

  const expenses = db.prepare(query).all(...params);
  res.json(expenses);
});

// GET /api/expenses/team - team expenses (manager/admin)
router.get('/team', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
  const db = getDB();
  let query, params;
  if (req.user.role === 'admin') {
    query = 'SELECT e.*, u.full_name as submitter_name FROM expenses e JOIN users u ON e.submitted_by = u.id WHERE e.company_id = ? ORDER BY e.created_at DESC';
    params = [req.user.company_id];
  } else {
    query = `SELECT e.*, u.full_name as submitter_name FROM expenses e
             JOIN users u ON e.submitted_by = u.id
             WHERE u.manager_id = ? ORDER BY e.created_at DESC`;
    params = [req.user.id];
  }
  res.json(db.prepare(query).all(...params));
});

// GET /api/expenses/:id - single expense with details
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDB();
  const expense = db.prepare(`
    SELECT e.*, u.full_name as submitter_name, u.avatar_color as submitter_color
    FROM expenses e JOIN users u ON e.submitted_by = u.id WHERE e.id = ?
  `).get(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });

  const lines = db.prepare('SELECT * FROM expense_lines WHERE expense_id = ?').all(req.params.id);
  const steps = db.prepare(`
    SELECT s.*, u.full_name as approver_name, u.avatar_color as approver_color
    FROM approval_steps s JOIN users u ON s.approver_id = u.id
    WHERE s.expense_id = ? ORDER BY s.step_order
  `).all(req.params.id);

  res.json({ ...expense, line_items: lines, approval_steps: steps });
});

// PUT /api/expenses/:id
router.put('/:id', authenticateToken, (req, res) => {
  const { title, description, category, currency, line_items } = req.body;
  const db = getDB();
  const expense = db.prepare('SELECT * FROM expenses WHERE id = ? AND submitted_by = ?').get(req.params.id, req.user.id);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  if (!['draft', 'rejected'].includes(expense.status)) {
    return res.status(400).json({ error: 'Cannot edit expense in current status' });
  }

  const total = line_items ? line_items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) : expense.total_amount;

  const transaction = db.transaction(() => {
    db.prepare('UPDATE expenses SET title = ?, description = ?, category = ?, currency = ?, total_amount = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(title || expense.title, description || expense.description, category || expense.category, currency || expense.currency, total, req.params.id);

    if (line_items) {
      db.prepare('DELETE FROM expense_lines WHERE expense_id = ?').run(req.params.id);
      const insertLine = db.prepare('INSERT INTO expense_lines (id, expense_id, description, amount, category, date) VALUES (?, ?, ?, ?, ?, ?)');
      for (const item of line_items) {
        insertLine.run(uuidv4(), req.params.id, item.description, parseFloat(item.amount), item.category || category, item.date || null);
      }
    }
  });
  transaction();
  res.json({ success: true });
});

module.exports = router;
