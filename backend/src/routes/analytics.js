const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const analytics = require("../services/analyticsService");
const config = require("../config");

const router = express.Router();

router.post(
  "/track",
  asyncHandler(async (req, res) => {
    const { event, props } = req.body;
    if (!event) return res.status(400).json({ error: true, message: "event is required" });
    analytics.track(req.userId, event, props || {});
    res.json({ ok: true, enabled: config.analyticsEnabled });
  })
);

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    res.json(analytics.summary(req.userId));
  })
);

module.exports = router;
