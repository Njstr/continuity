const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { profile, businessState, mission } = req.body;
    if (!profile || !businessState || !mission) {
      return res.status(400).json({ error: true, message: "profile, businessState, and mission are required" });
    }
    const result = await aiService.generateMissionImpact(req.userId, { profile, businessState, mission });
    res.json(result);
  })
);

module.exports = router;
