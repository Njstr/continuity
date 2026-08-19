const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { profile, businessState, metrics } = req.body;
    if (!profile || !businessState) {
      return res.status(400).json({ error: true, message: "profile and businessState are required" });
    }
    const result = await aiService.generateBusinessAdvice(req.userId, { profile, businessState, metrics });
    res.json(result);
  })
);

module.exports = router;
