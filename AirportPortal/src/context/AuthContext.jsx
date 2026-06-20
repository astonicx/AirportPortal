import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

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

    const login = async (email, password, rememberMe) => {
        await api.post("/api/auth/login", {
            email,
            password,
            rememberMe,
        });
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
