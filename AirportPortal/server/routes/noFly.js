"use strict";
const router = require("express").Router();
const { z } = require("zod");
const api = require("../utils/apiClient");

const schema = z.object({
    first: z.string(),
    middle: z.string().optional(),
    last: z.string(),
    dob: z.string(),
    gender: z.string(),
});

function norm(s) {
    return (s || "").trim().toLowerCase();
}

router.post("/check", async (req, res, next) => {
    try {
        const p = schema.parse(req.body);
        const list = await api.get("/v1/no-fly-list");
        const entries = list.entries || list || [];
        const hit = entries.find(
            (e) =>
                norm(e.first) === norm(p.first) &&
                norm(e.last) === norm(p.last) &&
                norm(e.dob) === norm(p.dob) &&
                norm(e.gender) === norm(p.gender)
        );
        res.json({ blocked: !!hit, reason: hit ? "Match on No Fly List" : null });
    } catch (e) {
        next(e);
    }
});

module.exports = router;
