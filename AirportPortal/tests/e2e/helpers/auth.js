import { expect, request } from "@playwright/test";

export async function loginByApiAndSetCookies({ page, baseURL, user }) {
    const api = await request.newContext({ baseURL });

    const response = await api.post("/api/auth/login", {
        data: {
            firstName: user.firstName,
            lastName: user.lastName,
            disambiguator: user.disambiguator,
            password: user.password,
            rememberMe: true,
        },
    });

    const responseBody = await response.text();
    expect(
        response.ok(),
        `Expected seeded login to succeed for ${user.firstName} ${user.lastName}. Response status: ${response.status()}. Body: ${responseBody}`
    ).toBeTruthy();

    const state = await api.storageState();
    if (state.cookies.length > 0) {
        await page.context().addCookies(state.cookies);
    }

    await api.dispose();
}

export async function mockAuthMe(page, user) {
    await page.route("**/api/auth/me", async (route) => {
        if (!user) {
            await route.fulfill({
                status: 401,
                contentType: "application/json",
                body: JSON.stringify({ error: "Unauthorized" }),
            });
            return;
        }

        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(user),
        });
    });
}
