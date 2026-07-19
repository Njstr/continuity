const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { companyProfile, metrics } = req.body;
    if (!companyProfile) return res.status(400).json({ error: true, message: "companyProfile is required" });
    const result = await aiService.generateStartupHealth(req.userId, { companyProfile, metrics });
    res.json(result);
  })
);

module.exports = router;
