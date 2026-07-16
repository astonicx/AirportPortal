import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [ready, setReady] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const me = await api.get("/api/auth/me");
            setUser(me);
        } catch {
            setUser(null);
        } finally {
            setReady(true);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // Immediate ban enforcement: react to the global ban event dispatched by the
    // API layer (on any 401 ACCOUNT_BANNED response). Clearing the user makes the
    // route guards redirect to /login on the next render.
    useEffect(() => {
        function onBanned(e) {
            setUser(null);
            try {
                toast.error("Your account has been banned.", {
                    description: e.detail?.reason || "Contact support for assistance.",
                });
            } catch {
                /* ignore toast errors */
            }
        }
        window.addEventListener("auth:banned", onBanned);
        return () => window.removeEventListener("auth:banned", onBanned);
    }, []);

    // While logged in, poll the session so an admin-issued ban terminates the
    // account promptly even if the user is idle. A banned response triggers the
    // "auth:banned" event above via the API layer.
    useEffect(() => {
        if (!user) return;
        const id = setInterval(() => {
            api.get("/api/auth/me").catch(() => { });
        }, 15_000);
        return () => clearInterval(id);
    }, [user]);

    const login = async (email, password, rememberMe) => {
        await api.post("/api/auth/login", {
            email,
            password,
            rememberMe,
        });
        // Persist the choice so useAutoLogout can skip the idle timer when set.
        try {
            localStorage.setItem("rememberMe", rememberMe ? "1" : "0");
        } catch {
            /* ignore storage errors */
        }
        await refresh();
    };
    const logout = async () => {
        try {
            await api.post("/api/auth/logout", {});
        } finally {
            setUser(null);
        }
    };

    return (
        <AuthCtx.Provider value={{ user, ready, refresh, login, logout }}>
            {children}
        </AuthCtx.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthCtx);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
