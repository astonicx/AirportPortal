/**
 * Unit tests for server/utils/validators.js
 *
 * All five Zod schemas are tested here:
 *   signupSchema, loginSchema, recoverInitSchema,
 *   recoverAnswerSchema, recoverResetSchema
 *
 * Each schema is tested for:
 *   - A complete valid payload (happy path)
 *   - Every required field missing individually
 *   - Invalid formats/types for key fields
 *   - Edge cases and optional field behaviour
 *
 * NOTE: A critical contract mismatch exists between the frontend Login page
 * (which submits { email, password }) and loginSchema (which expects
 * { firstName, lastName, password }). This is documented here so the fix
 * is visible to the team – see gap analysis report for full context.
 */
import { describe, it, expect } from "vitest";
import {
    signupSchema,
    loginSchema,
    recoverInitSchema,
    recoverAnswerSchema,
    recoverResetSchema,
} from "../../../../server/utils/validators.js";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Returns true if safeParse succeeds, false otherwise. */
function valid(schema, data) {
    return schema.safeParse(data).success;
}

/** Returns the error message keys from a failed safeParse. */
function errorPaths(schema, data) {
    const r = schema.safeParse(data);
    if (r.success) return [];
    return r.error.issues.map((i) => i.path.join("."));
}

// ── Base valid payloads ───────────────────────────────────────────────────────

const BASE_SIGNUP = {
    first_name: "Jane",
    last_name: "Doe",
    dob: "1990-05-15",
    gender: "female",
    address1: "123 Main St",
    city: "Milwaukee",
    state: "WI",
    zip: "53201",
    country: "USA",
    phone: "555-555-5555",
    email: "jane@example.com",
    password: "AnyPassword123",
    captchaAnswer: "4",
    captchaExpected: "4",
    securityQuestions: [
        { question: "What is your pet name?", answer: "Fluffy" },
        { question: "What city were you born in?", answer: "Chicago" },
        { question: "What is your elementary school?", answer: "Lincoln" },
    ],
};

const BASE_LOGIN = {
    firstName: "Jane",
    lastName: "Doe",
    password: "correctpassword",
};

const BASE_RECOVER_INIT = {
    firstName: "Jane",
    lastName: "Doe",
    dob: "1990-05-15",
};

const BASE_RECOVER_ANSWER = {
    userId: 42,
    answers: ["answer one", "answer two", "answer three"],
};

const BASE_RECOVER_RESET = {
    resetToken: "a".repeat(10), // minimum 10 chars
    password: "newpassword",
};

// ── signupSchema ──────────────────────────────────────────────────────────────

describe("signupSchema – happy path", () => {
    it("accepts a complete valid payload", () => {
        expect(valid(signupSchema, BASE_SIGNUP)).toBe(true);
    });

    it("accepts optional title", () => {
        expect(valid(signupSchema, { ...BASE_SIGNUP, title: "Dr." })).toBe(true);
    });

    it("accepts optional middle_name", () => {
        expect(valid(signupSchema, { ...BASE_SIGNUP, middle_name: "Marie" })).toBe(true);
    });

    it("accepts optional suffix", () => {
        expect(valid(signupSchema, { ...BASE_SIGNUP, suffix: "Jr." })).toBe(true);
    });

    it("accepts exactly 3 security questions", () => {
        expect(valid(signupSchema, BASE_SIGNUP)).toBe(true);
    });

    it("accepts more than 3 security questions", () => {
        const extra = { ...BASE_SIGNUP, securityQuestions: [...BASE_SIGNUP.securityQuestions, { question: "Extra question here?", answer: "extra" }] };
        expect(valid(signupSchema, extra)).toBe(true);
    });
});

describe("signupSchema – missing required fields", () => {
    const required = ["first_name", "last_name", "dob", "gender", "address1",
        "city", "state", "zip", "country", "phone", "email",
        "captchaAnswer", "captchaExpected"];

    required.forEach((field) => {
        it(`rejects when ${field} is missing`, () => {
            const { [field]: _omitted, ...rest } = BASE_SIGNUP;
            expect(valid(signupSchema, rest)).toBe(false);
        });
    });
});

describe("signupSchema – invalid formats", () => {
    it("rejects empty first_name", () => {
        expect(valid(signupSchema, { ...BASE_SIGNUP, first_name: "" })).toBe(false);
    });

    it("rejects empty last_name", () => {
        expect(valid(signupSchema, { ...BASE_SIGNUP, last_name: "" })).toBe(false);
    });

    it("rejects dob without dashes (YYYYMMDD)", () => {
        expect(valid(signupSchema, { ...BASE_SIGNUP, dob: "19900515" })).toBe(false);
    });

    it("rejects dob in MM/DD/YYYY format", () => {
        expect(valid(signupSchema, { ...BASE_SIGNUP, dob: "05/15/1990" })).toBe(false);
    });

    it("rejects dob with wrong number of digits", () => {
        expect(valid(signupSchema, { ...BASE_SIGNUP, dob: "990-5-5" })).toBe(false);
    });

    it("accepts dob in correct YYYY-MM-DD format", () => {
        expect(valid(signupSchema, { ...BASE_SIGNUP, dob: "2000-01-31" })).toBe(true);
    });

    it("rejects invalid email address", () => {
        expect(valid(signupSchema, { ...BASE_SIGNUP, email: "not-an-email" })).toBe(false);
    });

    it("rejects email without TLD", () => {
        expect(valid(signupSchema, { ...BASE_SIGNUP, email: "user@domain" })).toBe(false);
    });

    it("rejects fewer than 3 security questions", () => {
        const two = { ...BASE_SIGNUP, securityQuestions: BASE_SIGNUP.securityQuestions.slice(0, 2) };
        expect(valid(signupSchema, two)).toBe(false);
    });

    it("rejects a security question with empty answer", () => {
        const bad = {
            ...BASE_SIGNUP,
            securityQuestions: [
                { question: "Valid question text?", answer: "" },
                { question: "Another question here?", answer: "ok" },
                { question: "Third question here?", answer: "ok" },
            ],
        };
        expect(valid(signupSchema, bad)).toBe(false);
    });

    it("rejects a security question with too-short question text (< 3 chars)", () => {
        const bad = {
            ...BASE_SIGNUP,
            securityQuestions: [
                { question: "Q?", answer: "answer" }, // 2 chars – fails min(3)
                { question: "Second long question?", answer: "a" },
                { question: "Third long question?", answer: "b" },
            ],
        };
        expect(valid(signupSchema, bad)).toBe(false);
    });

    it("rejects empty captchaAnswer", () => {
        expect(valid(signupSchema, { ...BASE_SIGNUP, captchaAnswer: "" })).toBe(false);
    });

    it("rejects empty captchaExpected", () => {
        expect(valid(signupSchema, { ...BASE_SIGNUP, captchaExpected: "" })).toBe(false);
    });

    it("rejects non-array securityQuestions", () => {
        // @ts-expect-error intentional wrong type
        expect(valid(signupSchema, { ...BASE_SIGNUP, securityQuestions: "not an array" })).toBe(false);
    });
});

// ── loginSchema ───────────────────────────────────────────────────────────────
//
// CONTRACT BUG (documented, not fixed here):
// The frontend Login page POSTs { email, password, captcha, rememberMe }
// but loginSchema expects { firstName, lastName, password, [disambiguator], [rememberMe] }.
// Login is currently broken end-to-end because of this mismatch.

describe("loginSchema – happy path", () => {
    it("accepts minimal required fields", () => {
        expect(valid(loginSchema, BASE_LOGIN)).toBe(true);
    });

    it("accepts optional disambiguator", () => {
        expect(valid(loginSchema, { ...BASE_LOGIN, disambiguator: "2" })).toBe(true);
    });

    it("accepts rememberMe: true", () => {
        expect(valid(loginSchema, { ...BASE_LOGIN, rememberMe: true })).toBe(true);
    });

    it("accepts rememberMe: false", () => {
        expect(valid(loginSchema, { ...BASE_LOGIN, rememberMe: false })).toBe(true);
    });

    it("accepts when disambiguator is absent", () => {
        const { disambiguator: _d, ...rest } = { ...BASE_LOGIN, disambiguator: "2" };
        expect(valid(loginSchema, rest)).toBe(true);
    });
});

describe("loginSchema – missing required fields", () => {
    it("rejects missing firstName", () => {
        const { firstName: _f, ...rest } = BASE_LOGIN;
        expect(valid(loginSchema, rest)).toBe(false);
    });

    it("rejects missing lastName", () => {
        const { lastName: _l, ...rest } = BASE_LOGIN;
        expect(valid(loginSchema, rest)).toBe(false);
    });

    it("rejects missing password", () => {
        const { password: _p, ...rest } = BASE_LOGIN;
        expect(valid(loginSchema, rest)).toBe(false);
    });
});

describe("loginSchema – invalid values", () => {
    it("rejects empty firstName", () => {
        expect(valid(loginSchema, { ...BASE_LOGIN, firstName: "" })).toBe(false);
    });

    it("rejects empty lastName", () => {
        expect(valid(loginSchema, { ...BASE_LOGIN, lastName: "" })).toBe(false);
    });

    it("rejects empty password", () => {
        expect(valid(loginSchema, { ...BASE_LOGIN, password: "" })).toBe(false);
    });

    it("rejects rememberMe as a string", () => {
        // @ts-expect-error intentional wrong type
        expect(valid(loginSchema, { ...BASE_LOGIN, rememberMe: "yes" })).toBe(false);
    });
});

// ── recoverInitSchema ─────────────────────────────────────────────────────────
//
// CONTRACT BUG (documented, not fixed here):
// The frontend Recover page POSTs { email } for step 1.
// recoverInitSchema expects { firstName, lastName, dob }.
// Password recovery step 1 is currently broken end-to-end.

describe("recoverInitSchema – happy path", () => {
    it("accepts a complete payload", () => {
        expect(valid(recoverInitSchema, BASE_RECOVER_INIT)).toBe(true);
    });

    it("accepts empty strings (schema has no min constraints)", () => {
        // z.string() without .min(1) allows empty strings
        expect(valid(recoverInitSchema, { firstName: "", lastName: "", dob: "" })).toBe(true);
    });
});

describe("recoverInitSchema – missing fields", () => {
    ["firstName", "lastName", "dob"].forEach((field) => {
        it(`rejects when ${field} is missing`, () => {
            const { [field]: _omitted, ...rest } = BASE_RECOVER_INIT;
            expect(valid(recoverInitSchema, rest)).toBe(false);
        });
    });
});

describe("recoverInitSchema – invalid types", () => {
    it("rejects when firstName is a number", () => {
        // @ts-expect-error intentional wrong type
        expect(valid(recoverInitSchema, { ...BASE_RECOVER_INIT, firstName: 42 })).toBe(false);
    });
});

// ── recoverAnswerSchema ───────────────────────────────────────────────────────

describe("recoverAnswerSchema – happy path", () => {
    it("accepts exactly 3 answers", () => {
        expect(valid(recoverAnswerSchema, BASE_RECOVER_ANSWER)).toBe(true);
    });

    it("accepts more than 3 answers", () => {
        expect(valid(recoverAnswerSchema, { userId: 1, answers: ["a", "b", "c", "d"] })).toBe(true);
    });
});

describe("recoverAnswerSchema – validation failures", () => {
    it("rejects fewer than 3 answers", () => {
        expect(valid(recoverAnswerSchema, { userId: 1, answers: ["a", "b"] })).toBe(false);
    });

    it("rejects an empty answers array", () => {
        expect(valid(recoverAnswerSchema, { userId: 1, answers: [] })).toBe(false);
    });

    it("rejects a non-numeric userId", () => {
        // @ts-expect-error intentional wrong type
        expect(valid(recoverAnswerSchema, { userId: "not-a-number", answers: ["a", "b", "c"] })).toBe(false);
    });

    it("rejects missing userId", () => {
        expect(valid(recoverAnswerSchema, { answers: ["a", "b", "c"] })).toBe(false);
    });

    it("rejects missing answers", () => {
        expect(valid(recoverAnswerSchema, { userId: 1 })).toBe(false);
    });

    it("rejects when answers is not an array", () => {
        // @ts-expect-error intentional wrong type
        expect(valid(recoverAnswerSchema, { userId: 1, answers: "a,b,c" })).toBe(false);
    });
});

// ── recoverResetSchema ────────────────────────────────────────────────────────
//
// CONTRACT BUG (documented, not fixed here):
// The frontend Recover page POSTs { resetToken, newPassword }.
// recoverResetSchema expects { resetToken, password }.
// The field name mismatch means the reset step is broken end-to-end.

describe("recoverResetSchema – happy path", () => {
    it("accepts a valid reset token and password", () => {
        expect(valid(recoverResetSchema, BASE_RECOVER_RESET)).toBe(true);
    });

    it("accepts a longer token", () => {
        expect(valid(recoverResetSchema, { resetToken: "a".repeat(48), password: "newpass" })).toBe(true);
    });
});

describe("recoverResetSchema – validation failures", () => {
    it("rejects resetToken shorter than 10 characters", () => {
        expect(valid(recoverResetSchema, { resetToken: "short", password: "pass" })).toBe(false);
    });

    it("rejects exactly 9 character token", () => {
        expect(valid(recoverResetSchema, { resetToken: "a".repeat(9), password: "pass" })).toBe(false);
    });

    it("accepts exactly 10 character token (boundary)", () => {
        expect(valid(recoverResetSchema, { resetToken: "a".repeat(10), password: "pass" })).toBe(true);
    });

    it("rejects missing resetToken", () => {
        expect(valid(recoverResetSchema, { password: "newpassword" })).toBe(false);
    });

    it("rejects missing password", () => {
        expect(valid(recoverResetSchema, { resetToken: "a".repeat(10) })).toBe(false);
    });

    it("rejects non-string resetToken", () => {
        // @ts-expect-error intentional wrong type
        expect(valid(recoverResetSchema, { resetToken: 12345678901, password: "pass" })).toBe(false);
    });
});
