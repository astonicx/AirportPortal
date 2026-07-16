import { expect } from "@playwright/test";

export async function expectHeading(page, heading) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
}

export async function fillSearchInput(page, query) {
    const searchInput = page
        .getByRole("searchbox", { name: /search/i })
        .or(page.getByRole("searchbox"))
        .or(page.getByPlaceholder(/search/i))
        .first();

    await expect(searchInput).toBeVisible();
    await searchInput.fill(query);
    return searchInput;
}

export async function openNavLink(page, label) {
    await page.getByRole("link", { name: label }).click();
}

export async function expectPath(page, path) {
    await expect(page).toHaveURL(new RegExp(`${path}$`));
}
