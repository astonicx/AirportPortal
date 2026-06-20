import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, passwordPolicy } from './password.js';

describe('Password utilities - Integration Tests', () => {
    describe('Task: Password hashing and verification', () => {
        it('should hash and verify passwords correctly', async () => {
            const password = 'SecurePass123!';
            const hash = await hashPassword(password);

            expect(await verifyPassword(password, hash)).toBe(true);
            expect(await verifyPassword('WrongPassword', hash)).toBe(false);
        });

        it('should enforce password policy (weak ≤10, strong ≥18)', () => {
            // Weak (too short)
            let policy = passwordPolicy('short');
            expect(policy.ok).toBe(false);
            expect(policy.level).toBe('weak');

            // Medium (11-17 chars)
            policy = passwordPolicy('a'.repeat(11));
            expect(policy.ok).toBe(true);
            expect(policy.level).toBe('medium');

            // Strong (18+ chars)
            policy = passwordPolicy('a'.repeat(18));
            expect(policy.ok).toBe(true);
            expect(policy.level).toBe('strong');
        });
    });
});
