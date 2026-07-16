import { expect } from "@playwright/test";
import { expectHeading, expectPath, fillSearchInput, openNavLink } from "./ui";

export function authUserFor(role, seededUsers) {
    const user = seededUsers[role];
    return {
        id: user.id,
        type: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        mustChangePassword: !!user.mustChangePassword,
        mustCompleteProfile: !!user.mustCompleteProfile,
        autoLogoutMinutes: 15,
        defaultSort: "time",
    };
}

export async function assertCustomerDashboard(page) {
    await expectHeading(page, /welcome, seed/i);
    await expect(page.getByRole("heading", { name: /upcoming/i })).toBeVisible();
    await expect(page.getByText(/SEED01/i)).toBeVisible();
}

export async function runCustomerTicketView(page) {
    await page.getByRole("link", { name: /view/i }).first().click();
    await expectHeading(page, /ticket SEED01/i);
    await expect(page.getByText(/active/i)).toBeVisible();
}

export async function runAdminSearches(page) {
    await expectHeading(page, /control center|admin/i);

    await openNavLink(page, /customers/i);
    const customerSearch = await fillSearchInput(page, "seed.customer@test.local");
    await expect(customerSearch).toHaveValue("seed.customer@test.local");
    await expect(page.getByRole("heading", { name: /customers/i })).toBeVisible();

    await openNavLink(page, /tickets/i);
    await expectPath(page, "/admin/tickets");
    const ticketSearch = await fillSearchInput(page, "SEED01");
    await expect(ticketSearch).toHaveValue("SEED01");
}

export async function runAirportSearch(page) {
    await page.goto("/flights");
    await expectHeading(page, /flights/i);

    const searchInput = await fillSearchInput(page, "NO_MATCH_AIRPORT_12345");
    await expect(searchInput).toHaveValue("NO_MATCH_AIRPORT_12345");

    const arrivalsTab = page.getByRole("tab", { name: /arrivals/i });
    await arrivalsTab.click();
    await expect(arrivalsTab).toHaveAttribute("aria-selected", /true/i);
}

export async function runFlightWorkflow(page) {
    await page.goto("/flights/SEED-FLIGHT-1");

    await expectHeading(page, /SeedAir SD100/i);
    await expect(page.getByText(/scheduled/i)).toBeVisible();
    const bookLink = page.getByRole("link", { name: /book this flight/i });
    await expect(bookLink).toBeVisible();
    await expect(bookLink).toHaveAttribute("href", /\/book\/SEED-FLIGHT-1\/passenger$/);
}

export async function runGuestTicketLookup(page) {
    await page.goto("/ticket-lookup");

    await page.getByLabel(/last name/i).fill("Customer");
    await page.getByLabel(/confirmation code/i).fill("seed01");
    await page.getByRole("button", { name: /find ticket/i }).click();

    await expectHeading(page, /ticket SEED01/i);
    await expect(page.getByText(/seat/i)).toBeVisible();
}

export async function assertRootAdminAccess(page) {
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: /admins/i })).toBeVisible();

    const adminsLink = page.getByRole("link", { name: /admins/i });
    await expect(adminsLink).toHaveAttribute("href", /\/admin\/admins$/);
}

export async function logoutFromHeader(page) {
    await page.getByRole("button", { name: /log out/i }).click();
    await expectPath(page, "/login");
    await expectHeading(page, /log in/i);
}
