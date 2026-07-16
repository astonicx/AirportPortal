import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAutoLogout } from "@/hooks/useAutoLogout";
import ThemeToggle from "@/components/ThemeToggle";
import UpcomingSidebar from "@/components/layout/UpcomingSidebar";
import { toast } from "sonner";

function Nav() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const link = ({ isActive }) =>
        `relative rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`;

    const onLogout = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 shadow-header backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <div className="h-1 w-full bg-gradient-to-r from-primary via-primary to-accent" />
            <div className="container flex flex-wrap items-center gap-3 py-3">
                <Link to="/" className="group flex items-center gap-2.5">
                    <span className="flex items-center rounded-lg bg-brand-hero px-2 py-1.5 shadow-sm ring-1 ring-black/5 transition-transform group-hover:scale-105">
                        <img
                            src="/images/BDPA_logo.png"
                            alt="BDPA"
                            className="h-7 w-auto"
                        />
                    </span>
                    <span className="hidden text-lg font-extrabold tracking-tight sm:inline">
                        <span className="brand-gradient">AirportPortal</span>
                    </span>
                </Link>
                <nav className="ml-2 hidden flex-wrap items-center gap-1 md:flex">
                    <NavLink to="/flights" className={link}>Flights</NavLink>
                    <NavLink to="/book" className={link}>Book</NavLink>
                    <NavLink to="/ticket-lookup" className={link}>Lookup</NavLink>
                    {user && <NavLink to="/checkin" className={link}>Check in</NavLink>}
                    {user && <NavLink to="/dashboard" className={link}>Dashboard</NavLink>}
                    {user && <NavLink to="/settings" className={link}>Settings</NavLink>}
                    {(user?.type === "admin" || user?.type === "root") && (
                        <NavLink to="/admin" className={link}>Admin</NavLink>
                    )}
                    {user?.type === "attendant" && (
                        <NavLink to="/attendant" className={link}>Attendant</NavLink>
                    )}
                </nav>
                <div className="ml-auto flex items-center gap-2 text-sm">
                    <ThemeToggle />
                    {user ? (
                        <>
                            <span className="hidden text-muted-foreground sm:inline">
                                {user.firstName} {user.lastName}
                            </span>
                            <button
                                onClick={onLogout}
                                className="rounded-full border border-border px-3.5 py-1.5 font-medium transition-colors hover:bg-secondary"
                            >
                                Log out
                            </button>
                        </>
                    ) : (
                        <>
                            <Link
                                to="/login"
                                className="rounded-full border border-border px-3.5 py-1.5 font-medium transition-colors hover:bg-secondary"
                            >
                                Log in
                            </Link>
                            <Link
                                to="/signup"
                                className="rounded-full bg-primary px-4 py-1.5 font-semibold text-primary-foreground shadow-sm transition-all hover:shadow-md hover:brightness-110"
                            >
                                Sign up
                            </Link>
                        </>
                    )}
                </div>
                {/* Mobile nav */}
                <nav className="flex w-full flex-wrap items-center gap-1 md:hidden">
                    <NavLink to="/flights" className={link}>Flights</NavLink>
                    <NavLink to="/book" className={link}>Book</NavLink>
                    <NavLink to="/ticket-lookup" className={link}>Lookup</NavLink>
                    {user && <NavLink to="/checkin" className={link}>Check in</NavLink>}
                    {user && <NavLink to="/dashboard" className={link}>Dashboard</NavLink>}
                    {user && <NavLink to="/settings" className={link}>Settings</NavLink>}
                    {(user?.type === "admin" || user?.type === "root") && (
                        <NavLink to="/admin" className={link}>Admin</NavLink>
                    )}
                    {user?.type === "attendant" && (
                        <NavLink to="/attendant" className={link}>Attendant</NavLink>
                    )}
                </nav>
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
        <div className="flex min-h-screen flex-col">
            <a href="#main-content" className="skip-link">
                Skip to content
            </a>
            <Nav />
            <main
                id="main-content"
                key={loc.pathname}
                className="flex-1 animate-in-fade py-8"
            >
                {user ? (
                    <div className="grid gap-6 px-3 xl:grid-cols-[24rem_minmax(0,1fr)_24rem] xl:items-start xl:px-4">
                        <UpcomingSidebar />
                        <div className="min-w-0">
                            <div className="mx-auto w-full max-w-5xl">
                                <Outlet />
                            </div>
                        </div>
                        <div className="hidden xl:block" aria-hidden="true" />
                    </div>
                ) : (
                    <div className="container">
                        <Outlet />
                    </div>
                )}
            </main>
            <footer className="mt-8 border-t border-border/70 bg-card">
                <div className="container flex flex-col items-center justify-between gap-3 py-6 sm:flex-row">
                    <div className="flex items-center gap-2.5">
                        <span className="flex items-center rounded-lg bg-brand-hero px-2 py-1.5 shadow-sm ring-1 ring-black/5">
                            <img
                                src="/images/BDPA_logo.png"
                                alt="BDPA"
                                className="h-6 w-auto"
                            />
                        </span>
                        <span className="text-sm font-semibold">AirportPortal</span>
                    </div>
                    <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                        <Link to="/flights" className="transition-colors hover:text-foreground">Flights</Link>
                        <Link to="/ticket-lookup" className="transition-colors hover:text-foreground">Lookup</Link>
                        <Link to="/recover" className="transition-colors hover:text-foreground">Help</Link>
                    </nav>
                    <p className="text-xs text-muted-foreground">
                        © 2026 AirportPortal · Powered by BDPA
                    </p>
                </div>
            </footer>
        </div>
    );
}
