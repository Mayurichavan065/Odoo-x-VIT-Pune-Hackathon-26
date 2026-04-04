const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { getDB, initDB } = require("./db");

async function seed() {
  initDB();
  const db = getDB();

  console.log("🌱 Seeding database...");

  // Create company
  const companyId = uuidv4();
  db.prepare(
    "INSERT OR IGNORE INTO companies (id, name, base_currency) VALUES (?, ?, ?)",
  ).run(companyId, "Acme Corp", "INR");

  // Create users
  const pwd = await bcrypt.hash("password123", 10);
  const adminId = uuidv4(),
    managerId = uuidv4(),
    empId = uuidv4(),
    emp2Id = uuidv4();

  const insertUser = db.prepare(
    "INSERT OR IGNORE INTO users (id, email, password, full_name, role, company_id, manager_id, avatar_color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  insertUser.run(
    adminId,
    "admin@acme.com",
    pwd,
    "Raj Patil",
    "admin",
    companyId,
    null,
    "#6366F1",
  );
  insertUser.run(
    managerId,
    "manager@acme.com",
    pwd,
    "Mayuri Chavan",
    "manager",
    companyId,
    adminId,
    "#10B981",
  );
  insertUser.run(
    empId,
    "employee@acme.com",
    pwd,
    "Mitaal Shisode",
    "employee",
    companyId,
    managerId,
    "#F59E0B",
  );
  insertUser.run(
    emp2Id,
    "employee2@acme.com",
    pwd,
    "Mayur Kolekar",
    "employee",
    companyId,
    managerId,
    "#EC4899",
  );

  // Create expenses
  const expenses = [
    {
      title: "Train to Mumbai",
      category: "Travel",
      amount: 4500.0,
      status: "approved",
    },
    {
      title: "Client Lunch Meeting",
      category: "Meals",
      amount: 850.0,
      status: "approved",
    },
    {
      title: "Keyboard & Mouse",
      category: "Equipment",
      amount: 2100.0,
      status: "in_review",
    },
    {
      title: "Workshop Fee",
      category: "Travel",
      amount: 1500.0,
      status: "in_review",
    },
    {
      title: "Office Supplies Q4",
      category: "Supplies",
      amount: 850.0,
      status: "pending",
    },
    {
      title: "Station Parking",
      category: "Travel",
      amount: 150.0,
      status: "approved",
    },
    {
      title: "Team Snacks",
      category: "Meals",
      amount: 1200.0,
      status: "rejected",
    },
    {
      title: "Github Copilot License",
      category: "Equipment",
      amount: 2500.0,
      status: "approved",
    },
  ];

  const insertExpense = db.prepare(
    "INSERT INTO expenses (id, title, description, total_amount, currency, converted_amount, category, status, submitted_by, company_id, submitted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?))",
  );
  const insertLine = db.prepare(
    "INSERT INTO expense_lines (id, expense_id, description, amount, category, date) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertStep = db.prepare(
    "INSERT INTO approval_steps (id, expense_id, step_order, approver_id, status, comment, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );

  expenses.forEach((exp, i) => {
    const eid = uuidv4();
    const submitter = i % 2 === 0 ? empId : emp2Id;
    const dayOffset = `-${i * 3} days`;
    insertExpense.run(
      eid,
      exp.title,
      `Auto-generated seed expense #${i + 1}`,
      exp.amount,
      "INR",
      exp.amount,
      exp.category,
      exp.status,
      submitter,
      companyId,
      dayOffset,
      dayOffset,
    );
    insertLine.run(
      uuidv4(),
      eid,
      exp.title,
      exp.amount,
      exp.category,
      new Date().toISOString().split("T")[0],
    );

    // Approval steps
    insertStep.run(
      uuidv4(),
      eid,
      1,
      managerId,
      exp.status === "approved"
        ? "approved"
        : exp.status === "rejected"
          ? "rejected"
          : "pending",
      exp.status === "approved"
        ? "Looks good!"
        : exp.status === "rejected"
          ? "Missing documentation"
          : null,
      exp.status !== "pending" && exp.status !== "in_review"
        ? new Date().toISOString()
        : null,
    );
    if (exp.amount > 500) {
      insertStep.run(
        uuidv4(),
        eid,
        2,
        adminId,
        exp.status === "approved" ? "approved" : "pending",
        exp.status === "approved" ? "Approved by finance" : null,
        exp.status === "approved" ? new Date().toISOString() : null,
      );
    }
  });

  // Approval rules
  db.prepare(
    "INSERT INTO approval_rules (id, company_id, name, rule_type, auto_approve_below, is_active, priority) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    uuidv4(),
    companyId,
    "Auto-approve < ₹2000",
    "auto_approve",
    2000,
    1,
    1,
  );
  db.prepare(
    "INSERT INTO approval_rules (id, company_id, name, rule_type, percentage_threshold, is_active, priority) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(uuidv4(), companyId, "75% Approval Rule", "percentage", 75, 1, 2);
  db.prepare(
    "INSERT INTO approval_rules (id, company_id, name, rule_type, auto_approve_below, percentage_threshold, is_active, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    uuidv4(),
    companyId,
    "Hybrid: Auto < ₹5000 or 80%",
    "hybrid",
    5000,
    80,
    1,
    3,
  );

  // Category budgets — realistic monthly limits for a mid-size team
  const insertBudget = db.prepare(
    "INSERT OR IGNORE INTO category_budgets (id, company_id, category, monthly_limit) VALUES (?, ?, ?, ?)",
  );
  const budgets = [
    { category: "Travel", limit: 50000 }, // ₹50,000/month
    { category: "Meals", limit: 15000 }, // ₹15,000/month
    { category: "Equipment", limit: 75000 }, // ₹75,000/month — laptops, peripherals
    { category: "Supplies", limit: 10000 }, // ₹10,000/month
    { category: "Accommodation", limit: 30000 }, // ₹30,000/month — hotel stays
    { category: "Other", limit: 20000 }, // ₹20,000/month — miscellaneous
  ];
  budgets.forEach((b) =>
    insertBudget.run(uuidv4(), companyId, b.category, b.limit),
  );

  console.log("✅ Seed complete!");
  console.log("");
  console.log("📧 Demo Accounts (password: password123):");
  console.log("   Admin:    admin@acme.com");
  console.log("   Manager:  manager@acme.com");
  console.log("   Employee: employee@acme.com");
  console.log("");
  console.log("💰 Monthly Budgets:");
  budgets.forEach((b) =>
    console.log(`   ${b.category}: ₹${b.limit.toLocaleString()}`),
  );
}

seed();
