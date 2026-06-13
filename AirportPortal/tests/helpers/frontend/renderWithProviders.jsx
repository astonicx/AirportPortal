import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";

/**
 * Render a component with all required providers (Router, Auth).
 * Usage:
 *   renderWithProviders(<MyComponent />, { route: "/flights" })
 *   renderWithProviders(<MyComponent />, { route: "/flights", initialAuth: { user: {...} } })
 */
export function renderWithProviders(
    ui,
    { route = "/", initialAuth = null } = {}
) {
    // Create a wrapper with providers
    function Wrapper({ children }) {
        return (
            <MemoryRouter initialEntries={[route]}>
                <AuthProvider>{children}</AuthProvider>
            </MemoryRouter>
        );
    }

    return render(ui, { wrapper: Wrapper });
}
