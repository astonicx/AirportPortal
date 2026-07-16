"use strict";
const router = require("express").Router();
const { randomBytes } = require("crypto");
const { z } = require("zod");
const { db } = require("../db");
const { hashPassword, verifyPassword, passwordPolicy } = require("../utils/password");
const { issueSession, destroy, COOKIE, cookieOpts } = require("../utils/session");
const { requireAuth } = require("../middleware/auth");
const {
    signupSchema,
    loginSchema,
    recoverInitSchema,
    recoverAnswerSchema,
    recoverResetSchema,
} = require("../utils/validators");

// ── helpers ─────────────────────────────────────────────────────────────────
const userRole = (u) => u.user_type || u.type || "guest";

function publicUser(u) {
    return {
        id: u.id,
        type: userRole(u),
        user_type: userRole(u),
        firstName: u.first_name,
        lastName: u.last_name,
        email: u.email,
        mustChangePassword: !!u.must_change_password,
        mustCompleteProfile: !!u.must_complete_profile,
        autoLogoutMinutes: u.auto_logout_minutes,
        defaultSort: u.default_sort,
    };
}

// ── POST /api/auth/signup ───────────────────────────────────────────────────
router.post("/signup", async (req, res, next) => {
    try {
        const data = signupSchema.parse(req.body);

        if (data.captchaAnswer.trim() !== data.captchaExpected.trim()) {
            return res.status(400).json({ error: "CAPTCHA failed" });
        }

        const policy = passwordPolicy(data.password);
        if (!policy.ok) return res.status(400).json({ error: policy.reason });

        const pwHash = await hashPassword(data.password);

        const insertUser = db.prepare(
            `INSERT INTO users
       (type, title, first_name, middle_name, last_name, suffix, dob, gender,
        address1, city, state, zip, country, phone, email, login_disambiguator, password_hash, user_type)
       VALUES ('customer',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'customer')`
        );
        const insertQ = db.prepare(
            "INSERT INTO security_questions (user_id, question, answer_hash) VALUES (?, ?, ?)"
        );

        let userId;
        try {
            const info = insertUser.run(
                data.title || null,
                data.first_name,
                data.middle_name || null,
                data.last_name,
                data.suffix || null,
                data.dob,
                data.gender,
                data.address1,
                data.city,
                data.state,
                data.zip,
                data.country,
                data.phone,
                data.email,
                null,
                pwHash
            );
            userId = info.lastInsertRowid;
        } catch (e) {
            if (String(e.message).includes("UNIQUE")) {
                return res.status(409).json({ error: "Email already registered." });
            }
            throw e;
        }

        for (const q of data.securityQuestions) {
            const ah = await hashPassword(q.answer.trim().toLowerCase());
            insertQ.run(userId, q.question, ah);
        }

        res.status(201).json({
            ok: true,
            userId,
            email: data.email,
            strength: policy.level,
        });
    } catch (e) {
        next(e);
    }
});

// ── POST /api/auth/verify-email ─────────────────────────────────────────────
// Public: a customer confirms an admin-created account via their one-time token.
const verifyEmailSchema = z.object({ token: z.string().min(1) });

router.post("/verify-email", (req, res, next) => {
    try {
        const { token } = verifyEmailSchema.parse(req.body || {});
        const user = db
            .prepare(
                "SELECT id, email_verified, verification_token_expires FROM users WHERE verification_token=?"
            )
            .get(token);
        if (!user) {
            return res.status(400).json({ error: "Invalid or expired verification link." });
        }
        if (Number(user.email_verified) === 1) {
            return res.json({ ok: true, alreadyVerified: true });
        }
        if (
            user.verification_token_expires &&
            new Date(user.verification_token_expires) < new Date()
        ) {
            return res.status(400).json({ error: "Verification link has expired." });
        }
        db.prepare(
            "UPDATE users SET email_verified=1, verification_token=NULL, verification_token_expires=NULL WHERE id=?"
        ).run(user.id);
        res.json({ ok: true });
    } catch (e) {
        next(e);
    }
});

// ── POST /api/auth/login ────────────────────────────────────────────────────
function auditLogin(userId, req, success) {
    try {
        db.prepare(
            "INSERT INTO user_login_audit (user_id, ip, ua, success) VALUES (?, ?, ?, ?)"
        ).run(userId || null, req.ip || null, req.get("user-agent") || null, success ? 1 : 0);
    } catch {
        /* audit is best-effort */
    }
}

router.post("/login", async (req, res, next) => {
    try {
        const data = loginSchema.parse(req.body);

        // Optional captcha verification (only enforced when both fields present)
        if (data.captchaAnswer !== undefined && data.captchaExpected !== undefined) {
            if (String(data.captchaAnswer).trim() !== String(data.captchaExpected).trim()) {
                return res.status(400).json({ error: "CAPTCHA failed" });
            }
        }

        const user = db.prepare("SELECT * FROM users WHERE email=?").get(data.email);
        if (!user) {
            auditLogin(null, req, false);
            return res
                .status(401)
                .json({ error: "Invalid credentials", attemptsRemaining: 3 });
        }

        if (Number(user.is_banned) === 1) {
            auditLogin(user.id, req, false);
            return res.status(403).json({ error: "Account banned" });
        }

        if (Number(user.email_verified) === 0) {
            auditLogin(user.id, req, false);
            return res.status(403).json({
                error: "Account not verified. Please confirm your email before logging in.",
                code: "EMAIL_NOT_VERIFIED",
            });
        }

        // lockout check
        const lock = db
            .prepare("SELECT * FROM user_lockouts WHERE user_id=?")
            .get(user.id);
        if (lock?.locked_until && new Date(lock.locked_until) > new Date()) {
            auditLogin(user.id, req, false);
            return res
                .status(423)
                .json({ error: "Locked", lockedUntil: lock.locked_until });
        }

        const ok = await verifyPassword(data.password, user.password_hash);
        if (!ok) {
            const failed = (lock?.failed_count || 0) + 1;
            const lockedUntil =
                failed >= 3 ? new Date(Date.now() + 3600_000).toISOString() : null;
            db.prepare(
                `INSERT INTO user_lockouts (user_id, locked_until, failed_count)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           locked_until = excluded.locked_until,
           failed_count = excluded.failed_count`
            ).run(user.id, lockedUntil, failed);
            auditLogin(user.id, req, false);
            return res.status(401).json({
                error: "Invalid credentials",
                attemptsRemaining: Math.max(0, 3 - failed),
                lockedUntil,
            });
        }

        db.prepare("DELETE FROM user_lockouts WHERE user_id=?").run(user.id);
        db.prepare(
            "UPDATE users SET last_login_ip=?, last_login_datetime=datetime('now') WHERE id=?"
        ).run(req.ip, user.id);
        auditLogin(user.id, req, true);

        const { cookieValue, expires } = issueSession(
            user.id,
            !!data.rememberMe,
            user.auto_logout_minutes
        );
        res.cookie(COOKIE, cookieValue, cookieOpts(expires));

        const fresh = db.prepare("SELECT * FROM users WHERE id=?").get(user.id);
        res.json({ ok: true, user: publicUser(fresh) });
    } catch (e) {
        next(e);
    }
});

// ── POST /api/auth/logout ───────────────────────────────────────────────────
router.post("/logout", (req, res) => {
    if (req.session) destroy(req.session.id);
    res.clearCookie(COOKIE);
    res.json({ ok: true });
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────
router.get("/me", requireAuth, (req, res) => {
    const u = req.user;
    res.json({
        ...publicUser(u),
        lastLoginIp: u.last_login_ip,
        lastLoginDatetime: u.last_login_datetime,
    });
});

// ── Password recovery (customers only) ──────────────────────────────────────
const resetTokens = new Map(); // userId -> { token, expires }

router.post("/recover/init", (req, res, next) => {
    try {
        const { email } = recoverInitSchema.parse(req.body);
        const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
        if (!user) return res.status(404).json({ error: "Not found" });
        // Customers only — privileged accounts must use admin reset flows.
        const role = userRole(user);
        if (role === "admin" || role === "root") {
            return res.status(403).json({ error: "Admins cannot use password recovery" });
        }
        if (role === "attendant") {
            return res.status(403).json({ error: "Attendants cannot use password recovery" });
        }
        if (role !== "customer") {
            return res.status(403).json({ error: "Password recovery is for customer accounts only." });
        }
        const qs = db
            .prepare("SELECT id, question FROM security_questions WHERE user_id=?")
            .all(user.id);
        res.json({ userId: user.id, questions: qs.map((q) => q.question) });
    } catch (e) {
        next(e);
    }
});

router.post("/recover/answer", async (req, res, next) => {
    try {
        const { userId, answers } = recoverAnswerSchema.parse(req.body);
        const rows = db
            .prepare(
                "SELECT answer_hash FROM security_questions WHERE user_id=? ORDER BY id"
            )
            .all(userId);
        if (rows.length !== answers.length) {
            return res.status(400).json({ error: "Answers mismatch" });
        }
        for (let i = 0; i < rows.length; i++) {
            const ok = await verifyPassword(
                answers[i].trim().toLowerCase(),
                rows[i].answer_hash
            );
            if (!ok) return res.status(401).json({ error: "Recovery failed" });
        }
        const token = randomBytes(24).toString("hex");
        resetTokens.set(userId, { token, expires: Date.now() + 10 * 60_000 });
        res.json({ resetToken: token });
    } catch (e) {
        next(e);
    }
});

router.post("/recover/reset", async (req, res, next) => {
    try {
        const { resetToken, password, newPassword } = recoverResetSchema.parse(req.body);
        const nextPassword = password || newPassword;
        if (!nextPassword) {
            return res.status(400).json({ error: "password is required" });
        }
        const policy = passwordPolicy(nextPassword);
        if (!policy.ok) return res.status(400).json({ error: policy.reason });

        let userId = null;
        for (const [uid, entry] of resetTokens.entries()) {
            if (entry.token === resetToken && entry.expires > Date.now()) {
                userId = uid;
                break;
            }
        }
        if (!userId) {
            return res.status(400).json({ error: "Invalid or expired token" });
        }

        const hash = await hashPassword(nextPassword);
        db.prepare(
            "UPDATE users SET password_hash=?, must_change_password=0 WHERE id=?"
        ).run(hash, userId);
        resetTokens.delete(userId);
        res.json({ ok: true });
    } catch (e) {
        next(e);
    }
});

module.exports = router;
