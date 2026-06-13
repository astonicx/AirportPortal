import { test as base, expect } from "@playwright/test";
import { seededUsers } from "./seededUsers";
import { loginByApiAndSetCookies } from "../helpers/auth";

export const test = base.extend({
    seededUsers: async ({}, use) => {
        await use(seededUsers);
    },
    seededUserForRole: async ({ seededUsers }, use) => {
        const getUser = (role) => {
            const user = seededUsers[role];
            if (!user) throw new Error(`Unknown seeded user role: ${role}`);
            return user;
        };
        await use(getUser);
    },
    loginAs: async ({ page, baseURL, seededUserForRole }, use) => {
        const login = async (role) => {
            await loginByApiAndSetCookies({
                page,
                baseURL,
                user: seededUserForRole(role),
            });
        };

        await use(login);
    },
});

export { expect };
