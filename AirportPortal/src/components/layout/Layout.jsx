import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAutoLogout } from "@/hooks/useAutoLogout";
import { toast } from "sonner";

function Nav() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const link = ({ isActive }) =>
        `px-3 py-2 rounded hover:bg-secondary ${isActive ? "font-semibold" : ""}`;

    const onLogout = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <header className="border-b bg-background">
            <div className="container mx-auto flex flex-wrap items-center gap-2 px-4 py-3">
                <Link to="/" className="text-lg font-bold text-milwaukeeBlue">
                    ✈ AirportPortal
                </Link>
                <nav className="ml-4 flex flex-wrap gap-1 text-sm">
                    <NavLink to="/flights" className={link}>Flights</NavLink>
                    {user && <NavLink to="/book" className={link}>Book</NavLink>}
                    <NavLink to="/ticket-lookup" className={link}>Lookup</NavLink>
                    {user && <NavLink to="/dashboard" className={link}>Dashboard</NavLink>}
                    {user && <NavLink to="/settings" className={link}>Settings</NavLink>}
                    {(user?.type === "admin" || user?.type === "root") && (
                        <NavLink to="/admin" className={link}>Admin</NavLink>
                    )}
                </nav>
                <div className="ml-auto flex items-center gap-2 text-sm">
                    {user ? (
                        <>
                            <span className="text-muted-foreground">
                                {user.firstName} {user.lastName}
                            </span>
                            <button
                                onClick={onLogout}
                                className="rounded border px-3 py-1 hover:bg-secondary"
                            >
                                Log out
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="rounded border px-3 py-1 hover:bg-secondary">Log in</Link>
                            <Link
                                to="/signup"
                                className="rounded bg-milwaukeeBlue px-3 py-1 text-white hover:opacity-90"
                            >
                                Sign up
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}

export default function Layout() {
    const { user, ready, logout } = useAuth();
    const loc = useLocation();
    const navigate = useNavigate();

    useAutoLogout(user?.autoLogoutMinutes || 0, logout);

    // Forced first-login flow
    useEffect(() => {
        if (!ready || !user) return;
        if (
            (user.mustChangePassword || user.mustCompleteProfile) &&
            loc.pathname !== "/complete"
        ) {
            navigate("/complete", { replace: true });
        }
    }, [ready, user, loc.pathname, navigate]);

    // Bridge useLiveResource → sonner toasts
    useEffect(() => {
        function onToast(e) {
            toast(e.detail?.title || "Update", { description: e.detail?.description });
        }
        window.addEventListener("toast", onToast);
        return () => window.removeEventListener("toast", onToast);
    }, []);

    return (
        <div className="min-h-screen flex flex-col">
            <Nav />
            <main className="flex-1 container mx-auto px-4 py-6">
                <Outlet />
            </main>
            <footer className="border-t bg-background py-4 text-center text-xs text-muted-foreground">
                AirportPortal · BDPA 2025
            </footer>
        </div>
    );
}
