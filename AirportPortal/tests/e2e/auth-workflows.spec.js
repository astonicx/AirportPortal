import { test } from "./fixtures/testFixtures";
import { expectHeading } from "./helpers/ui";
import { mockAuthMe } from "./helpers/auth";
import {
    assertCustomerDashboard,
    assertRootAdminAccess,
    authUserFor,
    logoutFromHeader,
    runAdminSearches,
    runAirportSearch,
    runCustomerTicketView,
    runFlightWorkflow,
    runGuestTicketLookup,
} from "./helpers/workflows";

test.describe("E2E authentication and workflows (seeded users)", () => {
    test("1) Login flow and 2) Logout flow", async ({ page, loginAs, seededUsers }) => {
        await mockAuthMe(page, null);
        await page.goto("/login");
        await expectHeading(page, /log in/i);

        await loginAs("customer");
        await mockAuthMe(page, authUserFor("customer", seededUsers));
        await page.goto("/dashboard");

        await assertCustomerDashboard(page);
        await logoutFromHeader(page);
    });

    test("3) Customer workflow", async ({ page, loginAs, seededUsers }) => {
        await loginAs("customer");
        await mockAuthMe(page, authUserFor("customer", seededUsers));
        await page.goto("/dashboard");

        await assertCustomerDashboard(page);
        await runCustomerTicketView(page);
    });

    test("4) Admin workflow", async ({ page, loginAs, seededUsers }) => {
        await loginAs("admin");
        await mockAuthMe(page, authUserFor("admin", seededUsers));
        await page.goto("/admin");

        await runAdminSearches(page);
    });

    test("5) Airport search workflow", async ({ page }) => {
        await mockAuthMe(page, null);
        await runAirportSearch(page);
    });

    test("6) Flight workflow", async ({ page }) => {
        await mockAuthMe(page, null);
        await runFlightWorkflow(page);
    });

    test("7a) Required competition journey: guest ticket lookup", async ({ page }) => {
        await mockAuthMe(page, null);
        await runGuestTicketLookup(page);
    });

    test("7b) Required competition journey: root admin management access", async ({ page, loginAs, seededUsers }) => {
        await loginAs("root");
        await mockAuthMe(page, authUserFor("root", seededUsers));
        await assertRootAdminAccess(page);
    });
});
