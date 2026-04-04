# 💼 ReimburseFlow
### Smart Expense Reimbursement Management System

ReimburseFlow is a full-stack web application that automates the employee expense reimbursement process. It features role-based workflows, configurable approval rules, multi-currency support, and OCR receipt processing for seamless expense management across enterprises.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Seed database with demo data
npm run seed

# Start the server
npm start
```

Then open **http://localhost:3000** in your browser.

---

## 📧 Demo Accounts

| Role     | Email              | Password     |
|----------|--------------------|--------------|
| Admin    | admin@acme.com     | password123  |
| Manager  | manager@acme.com   | password123  |
| Employee | employee@acme.com  | password123  |

---

## ✨ Key Features

- **Expense Management:** Submit expenses with receipts, multi-currency support, and auto-categorization
- **Smart Workflows:** Sequential multi-step approval with real-time timeline visualization
- **Conditional Rules:** Auto-approve thresholds, percentage-based approval, and hybrid rules
- **OCR Processing:** Drag & drop receipt upload with automated data extraction
- **Role-Based Access:** Admin, Manager, and Employee roles with specific permissions
- **Dashboard:** Role-based KPI cards, charts, and expense tracking
- **User Management:** Manage team hierarchy and assign roles (Admin only)
- **Multi-Currency:** Support for USD, EUR, GBP, INR, JPY, and more

---

## 🛠 Tech Stack

- **Frontend:** Vanilla JavaScript, HTML5, CSS3 (Single Page Application)
- **Backend:** Node.js, Express.js
- **Database:** SQLite (better-sqlite3)
- **Authentication:** JWT (JSON Web Tokens)
- **Security:** bcryptjs for password hashing
- **File Upload:** Multer for receipt handling

---

## 🏗 Project Structure

```
server/                     # Backend
├── index.js               # Express server entry point
├── db.js                  # Database setup & schema
├── seed.js                # Demo data seeder
├── middleware/
│   └── auth.js            # JWT & role authentication
└── routes/
    ├── auth.js            # Signup, login, profile
    ├── users.js           # User management
    ├── expenses.js        # Expense CRUD & workflow
    ├── approvals.js       # Approval decisions
    ├── rules.js           # Conditional rules
    ├── currency.js        # Multi-currency conversion
    ├── ocr.js             # Receipt processing
    └── dashboard.js       # Analytics & KPIs

public/                     # Frontend SPA
├── index.html             # HTML entry
├── app.js                 # Main application logic
└── styles.css             # Design system & styling

data/                      # SQLite database
uploads/                   # Receipt storage
```

---

## 🔄 Workflow

1. **Employee** submits expense with receipt
2. **OCR** auto-extracts receipt data (optional)
3. **Manager** reviews and approves/rejects
4. **Admin** handles high-value approvals
5. **Rules Engine** processes auto-approvals based on conditions
6. **Status** updates in real-time dashboard

---

## 👥 Team

- **Mayuri Chavan**
- **Raj Patil**
- **Mayur Kolekar**
- **Mittal Shisode**

---

## 📄 License

Developed for Odoo x VIT Pune Hackathon 2024
