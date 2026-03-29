const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDB, initDB } = require('./db');

async function seed() {
  initDB();
  const db = getDB();

  console.log('🌱 Seeding database...');

  // Create company
  const companyId = uuidv4();
  db.prepare('INSERT OR IGNORE INTO companies (id, name, base_currency) VALUES (?, ?, ?)').run(companyId, 'Acme Corp', 'USD');

  // Create users
  const pwd = await bcrypt.hash('password123', 10);
  const adminId = uuidv4(), managerId = uuidv4(), empId = uuidv4(), emp2Id = uuidv4();

  const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, email, password, full_name, role, company_id, manager_id, avatar_color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertUser.run(adminId, 'admin@acme.com', pwd, 'Raj Patil', 'admin', companyId, null, '#6366F1');
  insertUser.run(managerId, 'manager@acme.com', pwd, 'Mayuri Chavan', 'manager', companyId, adminId, '#10B981');
  insertUser.run(empId, 'employee@acme.com', pwd, 'Mitaal Shisode', 'employee', companyId, managerId, '#F59E0B');
  insertUser.run(emp2Id, 'employee2@acme.com', pwd, 'Mayur Kolekar', 'employee', companyId, managerId, '#EC4899');

  // Create expenses
  const expenses = [
    { title: 'Business Trip to NYC', category: 'Travel', amount: 1250.00, status: 'approved' },
    { title: 'Client Lunch Meeting', category: 'Meals', amount: 85.50, status: 'approved' },
    { title: 'New Laptop Setup', category: 'Equipment', amount: 2100.00, status: 'in_review' },
    { title: 'Conference Registration', category: 'Travel', amount: 599.00, status: 'in_review' },
    { title: 'Office Supplies Q4', category: 'Supplies', amount: 234.75, status: 'pending' },
    { title: 'Airport Parking', category: 'Travel', amount: 45.00, status: 'approved' },
    { title: 'Team Dinner', category: 'Meals', amount: 312.00, status: 'rejected' },
    { title: 'Software License', category: 'Equipment', amount: 499.99, status: 'approved' },
  ];

  const insertExpense = db.prepare('INSERT INTO expenses (id, title, description, total_amount, currency, converted_amount, category, status, submitted_by, company_id, submitted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\', ?), datetime(\'now\', ?))');
  const insertLine = db.prepare('INSERT INTO expense_lines (id, expense_id, description, amount, category, date) VALUES (?, ?, ?, ?, ?, ?)');
  const insertStep = db.prepare('INSERT INTO approval_steps (id, expense_id, step_order, approver_id, status, comment, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?)');

  expenses.forEach((exp, i) => {
    const eid = uuidv4();
    const submitter = i % 2 === 0 ? empId : emp2Id;
    const dayOffset = `-${i * 3} days`;
    insertExpense.run(eid, exp.title, `Auto-generated seed expense #${i + 1}`, exp.amount, 'USD', exp.amount, exp.category, exp.status, submitter, companyId, dayOffset, dayOffset);
    insertLine.run(uuidv4(), eid, exp.title, exp.amount, exp.category, new Date().toISOString().split('T')[0]);

    // Approval steps
    insertStep.run(uuidv4(), eid, 1, managerId,
      exp.status === 'approved' ? 'approved' : exp.status === 'rejected' ? 'rejected' : 'pending',
      exp.status === 'approved' ? 'Looks good!' : exp.status === 'rejected' ? 'Missing documentation' : null,
      exp.status !== 'pending' && exp.status !== 'in_review' ? new Date().toISOString() : null
    );
    if (exp.amount > 500) {
      insertStep.run(uuidv4(), eid, 2, adminId,
        exp.status === 'approved' ? 'approved' : 'pending',
        exp.status === 'approved' ? 'Approved by finance' : null,
        exp.status === 'approved' ? new Date().toISOString() : null
      );
    }
  });

  // Approval rules
  db.prepare('INSERT INTO approval_rules (id, company_id, name, rule_type, auto_approve_below, is_active, priority) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), companyId, 'Auto-approve < $50', 'auto_approve', 50, 1, 1);
  db.prepare('INSERT INTO approval_rules (id, company_id, name, rule_type, percentage_threshold, is_active, priority) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), companyId, '75% Approval Rule', 'percentage', 75, 1, 2);
  db.prepare('INSERT INTO approval_rules (id, company_id, name, rule_type, auto_approve_below, percentage_threshold, is_active, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), companyId, 'Hybrid: Auto < $100 or 80%', 'hybrid', 100, 80, 1, 3);

  console.log('✅ Seed complete!');
  console.log('');
  console.log('📧 Demo Accounts (password: password123):');
  console.log('   Admin:    admin@acme.com');
  console.log('   Manager:  manager@acme.com');
  console.log('   Employee: employee@acme.com');
}

seed();
