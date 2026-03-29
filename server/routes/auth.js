const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password, full_name, role, company_name } = req.body;
    if (!email || !password || !full_name || !role || !company_name) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const db = getDB();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    // Auto-create company
    let company = db.prepare('SELECT id FROM companies WHERE name = ?').get(company_name);
    let company_id;
    if (!company) {
      company_id = uuidv4();
      db.prepare('INSERT INTO companies (id, name) VALUES (?, ?)').run(company_id, company_name);
    } else {
      company_id = company.id;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const colors = ['#6366F1','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#F97316'];
    const avatar_color = colors[Math.floor(Math.random() * colors.length)];

    db.prepare(
      'INSERT INTO users (id, email, password, full_name, role, company_id, avatar_color) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(userId, email, hashedPassword, full_name, role, company_id, avatar_color);

    const user = db.prepare('SELECT id, email, full_name, role, company_id, avatar_color FROM users WHERE id = ?').get(userId);
    const token = generateToken(user);

    res.status(201).json({ token, user: { ...user, company_name } });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const db = getDB();
    const user = db.prepare(`
      SELECT u.*, c.name as company_name FROM users u
      JOIN companies c ON u.company_id = c.id
      WHERE u.email = ?
    `).get(email);

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken(user);
    const { password: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  const db = getDB();
  const user = db.prepare(`
    SELECT u.id, u.email, u.full_name, u.role, u.company_id, u.avatar_color, u.manager_id,
           c.name as company_name, c.base_currency
    FROM users u JOIN companies c ON u.company_id = c.id
    WHERE u.id = ?
  `).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

module.exports = router;
