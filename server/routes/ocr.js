const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Setup multer for receipt uploads
const uploadDir = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".pdf", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Invalid file type"));
  },
});

// POST /api/ocr/upload - upload receipt and mock OCR
router.post(
  "/upload",
  authenticateToken,
  upload.single("receipt"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Mock OCR - simulate extracting data from receipt
    const mockOCRResults = [
      {
        vendor: "Ola Cabs",
        amount: 450,
        category: "Travel",
        date: new Date().toISOString().split("T")[0],
        description: "Cab to office",
      },
      {
        vendor: "Chai Point",
        amount: 150,
        category: "Meals",
        date: new Date().toISOString().split("T")[0],
        description: "Coffee with client",
      },
      {
        vendor: "Reliance Digital",
        amount: 840,
        category: "Supplies",
        date: new Date().toISOString().split("T")[0],
        description: "Printer cartridges",
      },
      {
        vendor: "RedBus",
        amount: 1550,
        category: "Travel",
        date: new Date().toISOString().split("T")[0],
        description: "Bus from BOM to PUNE",
      },
    ];

    const result =
      mockOCRResults[Math.floor(Math.random() * mockOCRResults.length)];

    res.json({
      file_path: `/uploads/${req.file.filename}`,
      ocr_data: {
        ...result,
        confidence: 0.92,
        raw_text: `Receipt from ${result.vendor}\nAmount: ₹${result.amount}\nDate: ${result.date}`,
      },
    });
  },
);

module.exports = router;
