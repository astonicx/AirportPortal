"use strict";
const argon2 = require("argon2");

// argon2id with memory-hard params. Salt is generated internally (16 bytes)
// and embedded in the returned PHC string. One column `password_hash` is enough.
const ARGON_OPTS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

async function hashPassword(plain) {
  if (typeof plain !== "string" || plain.length === 0) {
    throw new Error("Password must be a non-empty string.");
  }
  return argon2.hash(plain, ARGON_OPTS);
}

async function verifyPassword(plain, phc) {
  if (typeof plain !== "string" || typeof phc !== "string") return false;
  try {
    return await argon2.verify(phc, plain);
  } catch {
    return false;
  }
}

// Server-side enforcement of the Req 7 length policy.
function passwordPolicy(plain) {
  const len = (plain || "").length;
  if (len <= 10) {
    return { ok: false, level: "weak", reason: "Password must be longer than 10 characters." };
  }
  if (len >= 18) return { ok: true, level: "strong", reason: null };
  return { ok: true, level: "medium", reason: null };
}

module.exports = { hashPassword, verifyPassword, passwordPolicy };
