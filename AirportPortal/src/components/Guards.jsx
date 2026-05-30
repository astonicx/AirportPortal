import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Spinner from "./Spinner";

function Wait() {
    return (
        <div className="p-8">
            <Spinner />
        </div>
    );
}

export function RequireAuth({ children }) {
    const { user, ready } = useAuth();
    const loc = useLocation();
    if (!ready) return <Wait />;
    if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
    return children;
}

export function RequireAdmin({ children }) {
    const { user, ready } = useAuth();
    if (!ready) return <Wait />;
    if (!user) return <Navigate to="/login" replace />;
    if (user.type !== "admin" && user.type !== "root") {
        return <Navigate to="/" replace />;
    }
    return children;
}

export function RequireRoot({ children }) {
    const { user, ready } = useAuth();
    if (!ready) return <Wait />;
    if (!user || user.type !== "root") return <Navigate to="/" replace />;
    return children;
}
