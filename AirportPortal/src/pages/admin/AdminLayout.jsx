import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AdminLayout() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    useEffect(() => { api.get("/api/admin/stats").then(setStats).catch(() => { }); }, []);

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-bold">Admin</h1>
                <nav className="mt-2 flex gap-3 text-sm">
                    <Link to="/admin" className="underline">Dashboard</Link>
                    <Link to="/admin/customers" className="underline">Customers</Link>
                    <Link to="/admin/tickets" className="underline">Tickets</Link>
                    {user?.type === "root" && (
                        <Link to="/admin/admins" className="underline">Admins</Link>
                    )}
                </nav>
            </header>
            <Outlet context={{ stats }} />
        </div>
    );
}
