import { expect } from "@playwright/test";

export async function expectHeading(page, heading) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
}

export async function fillSearchInput(page, query) {
    await page.getByPlaceholder("Search…").fill(query);
}

export async function openNavLink(page, label) {
    await page.getByRole("link", { name: label }).click();
}

export async function expectPath(page, path) {
    await expect(page).toHaveURL(new RegExp(`${path}$`));
}
