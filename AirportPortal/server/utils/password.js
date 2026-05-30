"use strict";
const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 10;

/**
 * Hash a plain-text password.
 * @param {string} password
 * @returns {Promise<string>} bcrypt hash
 */
async function hashPassword(password) {
  if (!password || typeof password !== "string" || password.trim().length === 0) {
    throw new Error("Password must be a non-empty string.");
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plain-text password against a bcrypt hash.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, hash) {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a non-empty string.");
  }
  if (!hash || typeof hash !== "string") {
    throw new Error("Hash must be a valid string.");
  }
  return bcrypt.compare(password, hash);
}

/**
 * Return a numeric strength score 0-4 for the given password.
 * @param {string} password
 * @returns {number}
 */
function getPasswordStrength(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/d/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  return Math.min(score, 4);
}

/**
 * Return a human-readable label for the password strength.
 * @param {string} password
 * @returns {string}
 */
function getPasswordStrengthLabel(password) {
  const labels = ["Weak", "Fair", "Good", "Strong", "Very Strong"];
  return labels[getPasswordStrength(password)];
}

module.exports = { hashPassword, verifyPassword, getPasswordStrength, getPasswordStrengthLabel };
