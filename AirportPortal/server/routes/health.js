"use strict";
const router = require("express").Router();

router.get("/", (_req, res) => {
    res.json({ status: "ok", at: new Date().toISOString() });
});

module.exports = router;
