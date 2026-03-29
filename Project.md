# ReimburseFlow — Reimbursement Management Application

A full-stack reimbursement management system with configurable approval workflows, role-based permissions, multi-currency handling, and OCR receipt processing.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Seed the database with demo data
npm run seed

# Start the server
npm start
```

Then open **http://localhost:3000** in your browser.

## 📧 Demo Accounts

| Role     | Email              | Password     |
|----------|--------------------|--------------|
| Admin    | admin@acme.com     | password123  |
| Manager  | manager@acme.com   | password123  |
| Employee | employee@acme.com  | password123  |

## ✨ Features

### Authentication & Onboarding
- Email/password signup & login with JWT
- Auto company creation on first signup
- Role selection: Admin, Manager, Employee

### Dashboard
- Role-based KPI cards (total expenses, pending, approved, rejected)
- Expense category breakdown charts
- Recent expenses table

### Expense Management
- Submit expenses with title, category, currency, line items
- Upload receipts with OCR auto-fill
- Multi-currency support (USD, EUR, GBP, INR, JPY, etc.)
- Currency conversion at submission

### Approval Workflows
- Sequential multi-step approval (Manager → Admin)
- Real-time approval timeline visualization
- Approve/reject with comments
- Auto-routing based on manager hierarchy
- High-value expenses get additional approval levels

### Conditional Approval Rules
- **Auto-approve**: Expenses below a threshold auto-approve
- **Percentage**: If X% of approvers approve, auto-complete
- **Hybrid**: Combine auto-approve and percentage rules
- Toggle rules on/off, set priorities

### User Management (Admin)
- View all company users
- Assign/change roles
- Set manager hierarchy
- Color-coded avatar system

### OCR Receipt Processing
- Drag & drop receipt upload
- Mock OCR extraction (vendor, amount, category, date)
- One-click "Apply OCR Data" auto-fill

## 🏗 Architecture

```
Odoo-x-VIT-Pune-Hackathon-26/
├── server/                   # Backend (Express + SQLite)
│   ├── index.js              # Server entry point
│   ├── db.js                 # Database setup & schema
│   ├── seed.js               # Demo data seeder
│   ├── middleware/
│   │   └── auth.js           # JWT auth & role middleware
│   └── routes/
│       ├── auth.js           # Signup, login, profile
│       ├── users.js          # User management
│       ├── expenses.js       # Expense CRUD + workflow
│       ├── approvals.js      # Approval decisions + rules
│       ├── rules.js          # Conditional rule management
│       ├── currency.js       # Currency conversion
│       ├── ocr.js            # Receipt upload + OCR
│       └── dashboard.js      # Dashboard statistics
├── public/                   # Frontend (Vanilla HTML/CSS/JS SPA)
│   ├── index.html            # HTML entry point
│   ├── styles.css            # Complete design system
│   └── app.js                # SPA with routing & components
├── data/                     # SQLite database
├── uploads/                  # Receipt uploads
└── package.json
```

## 🎨 Design System

The UI implements the "Ethereal Ledger" design system:
- **Dark glassmorphism** theme with indigo (#6366F1) accent
- **Inter** font family
- Translucent cards with backdrop blur
- Color-coded status badges
- Smooth micro-animations
- Responsive layout with sidebar navigation

## 🔌 Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite (better-sqlite3)
- **Auth**: JWT (jsonwebtoken), bcryptjs
- **Frontend**: Vanilla HTML/CSS/JS SPA
- **File Upload**: Multer
- **Design**: Stitch MCP generated UI designs

## 📋 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/signup | Register new user |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user profile |
| GET | /api/users | List company users |
| GET | /api/users/managers | List managers |
| PUT | /api/users/:id/role | Update role |
| PUT | /api/users/:id/manager | Assign manager |
| POST | /api/expenses | Submit expense |
| GET | /api/expenses | My expenses |
| GET | /api/expenses/team | Team expenses |
| GET | /api/expenses/:id | Expense detail |
| PUT | /api/expenses/:id | Update expense |
| GET | /api/approvals/pending | Pending approvals |
| POST | /api/approvals/:id/decide | Approve/reject |
| GET | /api/approvals/history | Approval history |
| GET/POST | /api/rules | Manage approval rules |
| GET | /api/currency | List currencies |
| GET | /api/currency/convert | Convert currency |
| POST | /api/ocr/upload | Upload receipt + OCR |
| GET | /api/dashboard/stats | Dashboard metrics |
