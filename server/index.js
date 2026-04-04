const express = require("express");
const cors = require("cors");
const path = require("path");
const { initDB } = require("./db");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const expenseRoutes = require("./routes/expenses");
const approvalRoutes = require("./routes/approvals");
const ruleRoutes = require("./routes/rules");
const currencyRoutes = require("./routes/currency");
const ocrRoutes = require("./routes/ocr");
const dashboardRoutes = require("./routes/dashboard");
const budgetRoutes = require("./routes/budgets");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend
app.use(express.static(path.join(__dirname, "..", "public")));

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/rules", ruleRoutes);
app.use("/api/currency", currencyRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/budgets", budgetRoutes);

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// Initialize DB and start server
initDB();

app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════════╗`);
  console.log(`  ║   🚀 ReimburseFlow Server Running        ║`);
  console.log(`  ║   📍 http://localhost:${PORT}              ║`);
  console.log(`  ╚══════════════════════════════════════════╝\n`);
});
