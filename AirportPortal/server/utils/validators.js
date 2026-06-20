"use strict";
const { z } = require("zod");

const signupSchema = z.object({
    title: z.string().optional(),
    first_name: z.string().min(1),
    middle_name: z.string().optional(),
    last_name: z.string().min(1),
    suffix: z.string().optional(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    gender: z.string().min(1),
    address1: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zip: z.string().min(1),
    country: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().email(),
    password: z.string(),
    captchaAnswer: z.string().min(1),
    captchaExpected: z.string().min(1),
    securityQuestions: z
        .array(z.object({ question: z.string().min(3), answer: z.string().min(1) }))
        .min(3),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    rememberMe: z.boolean().optional(),
});

const recoverInitSchema = z.object({
    email: z.string().email(),
});
const recoverAnswerSchema = z.object({
    userId: z.number(),
    answers: z.array(z.string()).min(3),
});
const recoverResetSchema = z.object({
    resetToken: z.string().min(10),
    newPassword: z.string(),
});

module.exports = {
    signupSchema,
    loginSchema,
    recoverInitSchema,
    recoverAnswerSchema,
    recoverResetSchema,
};
