import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Captcha from "@/components/Captcha";

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const loc = useLocation();
    const from = loc.state?.from?.pathname || "/dashboard";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [captcha, setCaptcha] = useState("");
    const [expected, setExpected] = useState("");
    const [rememberMe, setRemember] = useState(false);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setError(null);
        if (captcha !== expected) {
            setError("Captcha incorrect.");
            return;
        }
        setBusy(true);
        try {
            await login(email, password, rememberMe);
            navigate(from, { replace: true });
        } catch (err) {
            const remaining = err.data?.attemptsRemaining;
            setError(
                err.data?.error ||
                err.message ||
                (remaining != null ? `Login failed (${remaining} attempts left).` : "Login failed.")
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="animate-in-up mx-auto grid max-w-4xl overflow-hidden rounded-2xl border border-border/70 bg-card shadow-elevated md:grid-cols-2">
            {/* Brand panel */}
            <aside className="relative hidden bg-brand-hero p-8 text-white md:flex md:flex-col md:justify-between">
                <div className="pointer-events-none absolute inset-0 bg-brand-sheen" />
                <div className="relative flex items-center gap-2.5">
                    <img
                        src="/images/BDPA_logo.png"
                        alt="BDPA"
                        className="h-10 w-auto"
                    />
                    <span className="text-lg font-extrabold tracking-tight">AirportPortal</span>
                </div>
                <div className="relative space-y-3">
                    <h2 className="text-3xl font-bold leading-tight text-white">
                        Welcome back to the friendly skies.
                    </h2>
                    <p className="text-sm text-white/80">
                        Manage bookings, check flights, and access your travel dashboard — all in
                        one professional portal.
                    </p>
                </div>
                <p className="relative text-xs text-white/70">Powered by BDPA · 2026</p>
            </aside>

            {/* Form panel */}
            <div className="p-8 sm:p-10">
                <div className="mb-6 space-y-1">
                    <h1>Log in</h1>
                    <p className="text-sm text-muted-foreground">
                        Enter your credentials to access your account.
                    </p>
                </div>
                <form onSubmit={submit} className="space-y-4">
                    <label className="block text-sm font-medium">
                        Email
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            placeholder="you@example.com"
                            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        />
                    </label>
                    <label className="block text-sm font-medium">
                        Password
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            placeholder="••••••••••"
                            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        />
                    </label>
                    <Captcha
                        value={captcha}
                        onChange={setCaptcha}
                        onChallengeChange={setExpected}
                    />
                    <label className="inline-flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRemember(e.target.checked)}
                            className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        Remember me
                    </label>
                    {error && (
                        <p
                            role="alert"
                            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                        >
                            <span aria-hidden>⚠</span>
                            <span>{error}</span>
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={busy}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-60"
                    >
                        {busy && (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        )}
                        {busy ? "Signing in…" : "Sign in"}
                    </button>
                </form>
                <div className="mt-6 flex justify-between text-sm">
                    <Link to="/recover" className="font-medium text-primary hover:underline">
                        Forgot password?
                    </Link>
                    <Link to="/signup" className="font-medium text-primary hover:underline">
                        Create account
                    </Link>
                </div>
            </div>
        </div>
    );
}
