const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/rules - list company rules
router.get('/', authenticateToken, requireRole('admin'), (req, res) => {
  const db = getDB();
  const rules = db.prepare(`
    SELECT r.*, u.full_name as approver_name FROM approval_rules r
    LEFT JOIN users u ON r.approver_id = u.id
    WHERE r.company_id = ? ORDER BY r.priority
  `).all(req.user.company_id);
  res.json(rules);
});

// POST /api/rules - create rule
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  const { name, rule_type, condition_field, condition_operator, condition_value, auto_approve_below, approver_id, percentage_threshold, priority } = req.body;
  if (!name || !rule_type) return res.status(400).json({ error: 'Name and rule type required' });

  const db = getDB();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO approval_rules (id, company_id, name, rule_type, condition_field, condition_operator, condition_value, auto_approve_below, approver_id, percentage_threshold, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.company_id, name, rule_type, condition_field || null, condition_operator || null, condition_value || null, auto_approve_below || null, approver_id || null, percentage_threshold || null, priority || 0);

  res.status(201).json({ id, name, rule_type });
});

// PUT /api/rules/:id - update rule
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { name, rule_type, auto_approve_below, approver_id, percentage_threshold, is_active, priority } = req.body;
  const db = getDB();
  db.prepare(`
    UPDATE approval_rules SET name = ?, rule_type = ?, auto_approve_below = ?, approver_id = ?,
    percentage_threshold = ?, is_active = ?, priority = ? WHERE id = ? AND company_id = ?
  `).run(name, rule_type, auto_approve_below || null, approver_id || null, percentage_threshold || null, is_active ?? 1, priority || 0, req.params.id, req.user.company_id);
  res.json({ success: true });
});

// DELETE /api/rules/:id
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM approval_rules WHERE id = ? AND company_id = ?').run(req.params.id, req.user.company_id);
  res.json({ success: true });
});

module.exports = router;
