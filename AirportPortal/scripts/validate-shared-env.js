"use strict";

function asBool(value) {
    const v = String(value || "").trim().toLowerCase();
    if (v === "true" || v === "1") return true;
    if (v === "false" || v === "0") return false;
    return null;
}

function fail(msg) {
    console.error(`shared-env validation failed: ${msg}`);
}

const errors = [];

const dbPath = String(process.env.DB_PATH || "").trim();
if (!dbPath) {
    errors.push("DB_PATH is required and must point to the shared sqlite file.");
}

const originsRaw = String(process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || "").trim();
if (!originsRaw) {
    errors.push("CLIENT_ORIGINS is required (comma-separated frontend origins).");
}

const origins = originsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
if (originsRaw && origins.length === 0) {
    errors.push("CLIENT_ORIGINS must include at least one origin.");
}
if (origins.some((o) => o === "*")) {
    errors.push("CLIENT_ORIGINS cannot include '*' when credentials are enabled.");
}

const sameSite = String(process.env.SESSION_COOKIE_SAME_SITE || "").trim().toLowerCase();
if (sameSite !== "none") {
    errors.push("SESSION_COOKIE_SAME_SITE must be 'none' for cross-origin shared-dev cookies.");
}

const secure = asBool(process.env.SESSION_COOKIE_SECURE);
if (secure !== true) {
    errors.push("SESSION_COOKIE_SECURE must be true when SESSION_COOKIE_SAME_SITE=none.");
}

if (errors.length) {
    errors.forEach(fail);
    console.error("Example:");
    console.error(
        "DB_PATH=/abs/path/shared.sqlite CLIENT_ORIGINS=http://localhost:3000,https://team.example SESSION_COOKIE_SAME_SITE=none SESSION_COOKIE_SECURE=true npm run dev:server:shared"
    );
    process.exit(1);
}

console.log("shared-env validation passed.");
