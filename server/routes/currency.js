const express = require("express");
const { getDB } = require("../db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// GET /api/currency - list all currencies
router.get("/", authenticateToken, (req, res) => {
  const db = getDB();
  const currencies = db.prepare("SELECT * FROM currencies ORDER BY code").all();
  res.json(currencies);
});

// GET /api/currency/convert
router.get("/convert", authenticateToken, (req, res) => {
  const { from, to, amount } = req.query;
  if (!from || !to || !amount)
    return res.status(400).json({ error: "from, to, and amount required" });

  const db = getDB();
  const fromCurrency = db
    .prepare("SELECT * FROM currencies WHERE code = ?")
    .get(from);
  const toCurrency = db
    .prepare("SELECT * FROM currencies WHERE code = ?")
    .get(to);

  if (!fromCurrency || !toCurrency)
    return res.status(404).json({ error: "Currency not found" });

  const usdAmount = parseFloat(amount) / fromCurrency.rate_to_usd;
  const convertedAmount = usdAmount * toCurrency.rate_to_usd;

  res.json({
    from,
    to,
    original_amount: parseFloat(amount),
    converted_amount: Math.round(convertedAmount * 100) / 100,
    rate: toCurrency.rate_to_usd / fromCurrency.rate_to_usd,
  });
});

// Country to currency mapping
const COUNTRY_CURRENCY = {
  US: "USD",
  GB: "GBP",
  IN: "INR",
  JP: "JPY",
  CA: "CAD",
  AU: "AUD",
  CH: "CHF",
  CN: "CNY",
  SG: "SGD",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  BE: "EUR",
};

// GET /api/currency/country/:code
router.get("/country/:code", authenticateToken, (req, res) => {
  const currency = COUNTRY_CURRENCY[req.params.code.toUpperCase()];
  if (!currency) return res.json({ currency: "USD" });
  res.json({ currency, country: req.params.code.toUpperCase() });
});

module.exports = router;
