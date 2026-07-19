const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const authService = require("../services/authService");
const config = require("../config");

const router = express.Router();

router.get(
  "/status",
  asyncHandler(async (req, res) => {
    res.json({ authEnabled: config.authEnabled });
  })
);

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    if (!config.authEnabled) return res.status(400).json({ error: true, message: "Auth is disabled — running in local mode." });
    const { email, password } = req.body;
    const result = await authService.register(email, password);
    res.json(result);
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    if (!config.authEnabled) return res.status(400).json({ error: true, message: "Auth is disabled — running in local mode." });
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json(result);
  })
);

module.exports = router;
