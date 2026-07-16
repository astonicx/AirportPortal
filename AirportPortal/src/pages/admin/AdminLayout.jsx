import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AdminLayout() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    useEffect(() => { api.get("/api/admin/stats").then(setStats).catch(() => { }); }, []);

    const tabClass = ({ isActive }) =>
        `rounded-lg px-3.5 py-1.5 font-medium transition-colors ${isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`;

    return (
        <div className="animate-in-up space-y-6">
            <header className="space-y-3">
                <div className="flex items-center gap-2">
                    <span className="pill pill-info">Admin</span>
                    <h1>Control center</h1>
                </div>
                <nav className="flex flex-wrap gap-1 rounded-xl border border-border/70 bg-card p-1 text-sm shadow-card">
                    <NavLink to="/admin" end className={tabClass}>Dashboard</NavLink>
                    <NavLink to="/admin/customers" className={tabClass}>Customers</NavLink>
                    <NavLink to="/admin/attendants" className={tabClass}>Attendants</NavLink>
                    <NavLink to="/admin/tickets" className={tabClass}>Tickets</NavLink>
                    {user?.type === "root" && (
                        <NavLink to="/admin/admins" className={tabClass}>Admins</NavLink>
                    )}
                </nav>
            </header>
            <Outlet context={{ stats }} />
        </div>
    );
}
