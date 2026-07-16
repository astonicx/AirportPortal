"use strict";

const { db } = require("../db");

// Ensures a frequent_flier_accounts row exists for a customer and returns it.
function ensureAccount(userId) {
    if (!userId) return null;
    db.prepare(
        `INSERT INTO frequent_flier_accounts (user_id, ffm_balance, lifetime_earned, lifetime_spent)
         VALUES (?, 0, 0, 0)
         ON CONFLICT(user_id) DO NOTHING`
    ).run(userId);
    return db
        .prepare("SELECT * FROM frequent_flier_accounts WHERE user_id=?")
        .get(userId);
}

function getBalance(userId) {
    const acct = ensureAccount(userId);
    return {
        ffmBalance: acct?.ffm_balance ?? 0,
        lifetimeEarned: acct?.lifetime_earned ?? 0,
        lifetimeSpent: acct?.lifetime_spent ?? 0,
    };
}

// Spend points (does not go below zero unless forced). Returns new balance.
function spend(userId, points) {
    if (!userId || points <= 0) return getBalance(userId).ffmBalance;
    ensureAccount(userId);
    db.prepare(
        `UPDATE frequent_flier_accounts
         SET ffm_balance = ffm_balance - ?, lifetime_spent = lifetime_spent + ?,
             updated_at = datetime('now')
         WHERE user_id=?`
    ).run(points, points, userId);
    return getBalance(userId).ffmBalance;
}

// Earn points. Returns new balance.
function earn(userId, points) {
    if (!userId || points <= 0) return getBalance(userId).ffmBalance;
    ensureAccount(userId);
    db.prepare(
        `UPDATE frequent_flier_accounts
         SET ffm_balance = ffm_balance + ?, lifetime_earned = lifetime_earned + ?,
             updated_at = datetime('now')
         WHERE user_id=?`
    ).run(points, points, userId);
    return getBalance(userId).ffmBalance;
}

module.exports = { ensureAccount, getBalance, spend, earn };
