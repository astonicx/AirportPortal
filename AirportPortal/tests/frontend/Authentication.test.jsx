import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import App from "@/App";
import { renderWithProviders } from "../helpers/frontend/renderWithProviders";
import { frontendServer } from "../setup/msw/frontend-server";

function readCaptchaAnswer() {
    const text = document.body.textContent || "";
    const m = text.match(/What is\s*(\d+)\s*\+\s*(\d+)\s*\?/i);
    if (!m) return "";
    return String(Number(m[1]) + Number(m[2]));
}

describe("Frontend Authentication", () => {
    it("completes login flow and lands on dashboard", async () => {
        let loggedIn = false;
        let loginCalled = false;

        frontendServer.use(
            http.get("*/api/auth/me", () => {
                if (!loggedIn) {
                    return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
                }
                return HttpResponse.json({
                    id: 1,
                    email: "customer@example.com",
                    firstName: "Casey",
                    lastName: "Traveler",
                    type: "customer",
                });
            }),
            http.post("*/api/auth/login", async () => {
                loginCalled = true;
                loggedIn = true;
                return HttpResponse.json({ ok: true });
            })
        );

        const user = userEvent.setup();
        renderWithProviders(<App />, { route: "/login" });

        await screen.findByRole("heading", { name: /log in/i });
        await user.type(screen.getByLabelText(/email/i), "customer@example.com");
        await user.type(screen.getByLabelText(/password/i), "Password123!@");

        const captchaInput = document.querySelector('input[inputmode="numeric"]');
        expect(captchaInput).toBeInTheDocument();
        await user.type(captchaInput, readCaptchaAnswer());
        await user.click(screen.getByRole("button", { name: /sign in/i }));

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: /welcome/i })).toBeInTheDocument();
        });
        expect(loginCalled).toBe(true);
    });

    it("completes logout flow and returns to login", async () => {
        let loggedIn = true;
        let logoutCalled = false;

        frontendServer.use(
            http.get("*/api/auth/me", () => {
                if (!loggedIn) {
                    return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
                }
                return HttpResponse.json({
                    id: 1,
                    email: "customer@example.com",
                    firstName: "Casey",
                    lastName: "Traveler",
                    type: "customer",
                });
            }),
            http.post("*/api/auth/logout", () => {
                logoutCalled = true;
                loggedIn = false;
                return HttpResponse.json({ ok: true });
            })
        );

        const user = userEvent.setup();
        renderWithProviders(<App />, { route: "/flights" });

        const logoutButton = await screen.findByRole("button", { name: /log out/i });
        await user.click(logoutButton);

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: /log in/i })).toBeInTheDocument();
        });
        expect(logoutCalled).toBe(true);
    });

    it("keeps authenticated state across app remount (token persistence)", async () => {
        let meCalls = 0;

        frontendServer.use(
            http.get("*/api/auth/me", () => {
                meCalls += 1;
                return HttpResponse.json({
                    id: 1,
                    email: "persist@example.com",
                    firstName: "Persist",
                    lastName: "User",
                    type: "customer",
                });
            })
        );

        const firstRender = renderWithProviders(<App />, { route: "/dashboard" });
        await screen.findByRole("heading", { name: /welcome/i });
        firstRender.unmount();

        renderWithProviders(<App />, { route: "/dashboard" });
        await screen.findByRole("heading", { name: /welcome/i });

        expect(meCalls).toBeGreaterThanOrEqual(2);
    });

    it("redirects unauthenticated users away from protected routes", async () => {
        frontendServer.use(
            http.get("*/api/auth/me", () => {
                return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
            })
        );

        renderWithProviders(<App />, { route: "/dashboard" });

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: /log in/i })).toBeInTheDocument();
        });
    });

    it("redirects unauthorized customer away from admin routes", async () => {
        frontendServer.use(
            http.get("*/api/auth/me", () => {
                return HttpResponse.json({
                    id: 1,
                    email: "customer@example.com",
                    firstName: "Customer",
                    lastName: "Only",
                    type: "customer",
                });
            })
        );

        renderWithProviders(<App />, { route: "/admin" });

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: /flights/i })).toBeInTheDocument();
        });
    });

    it("renders role-specific navigation for admin users", async () => {
        frontendServer.use(
            http.get("*/api/auth/me", () => {
                return HttpResponse.json({
                    id: 2,
                    email: "admin@example.com",
                    firstName: "Alex",
                    lastName: "Admin",
                    type: "admin",
                });
            })
        );

        renderWithProviders(<App />, { route: "/flights" });

        await waitFor(() => {
            expect(screen.getByRole("link", { name: /^admin$/i })).toBeInTheDocument();
        });
    });

    it("hides admin navigation for customer users", async () => {
        frontendServer.use(
            http.get("*/api/auth/me", () => {
                return HttpResponse.json({
                    id: 1,
                    email: "customer@example.com",
                    firstName: "Casey",
                    lastName: "Traveler",
                    type: "customer",
                });
            })
        );

        renderWithProviders(<App />, { route: "/flights" });

        await screen.findByRole("heading", { name: /flights/i });
        expect(screen.queryByRole("link", { name: /^admin$/i })).not.toBeInTheDocument();
    });

    it("enforces status-specific redirect when profile completion is required", async () => {
        frontendServer.use(
            http.get("*/api/auth/me", () => {
                return HttpResponse.json({
                    id: 1,
                    email: "firstlogin@example.com",
                    firstName: "First",
                    lastName: "Login",
                    type: "customer",
                    mustCompleteProfile: true,
                    mustChangePassword: false,
                });
            })
        );

        renderWithProviders(<App />, { route: "/dashboard" });

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: /complete your account/i })).toBeInTheDocument();
        });
    });

    it("renders status-specific fields for password change requirement", async () => {
        frontendServer.use(
            http.get("*/api/auth/me", () => {
                return HttpResponse.json({
                    id: 1,
                    email: "mustchange@example.com",
                    firstName: "First",
                    lastName: "Login",
                    type: "customer",
                    mustCompleteProfile: false,
                    mustChangePassword: true,
                });
            })
        );

        renderWithProviders(<App />, { route: "/complete" });

        await waitFor(() => {
            expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
        });
    });
});
