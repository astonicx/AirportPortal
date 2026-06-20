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
        <div className="mx-auto max-w-md space-y-4">
            <h1 className="text-2xl font-bold">Log in</h1>
            <form onSubmit={submit} className="space-y-3">
                <label className="block text-sm">
                    Email
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="mt-1 w-full rounded border px-3 py-2"
                    />
                </label>
                <label className="block text-sm">
                    Password
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="mt-1 w-full rounded border px-3 py-2"
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
                    />
                    Remember me
                </label>
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}
                <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded bg-milwaukeeBlue px-4 py-2 text-white disabled:opacity-60"
                >
                    {busy ? "Signing in…" : "Sign in"}
                </button>
            </form>
            <div className="flex justify-between text-sm">
                <Link to="/recover" className="underline">
                    Forgot password?
                </Link>
                <Link to="/signup" className="underline">
                    Create account
                </Link>
            </div>
        </div>
    );
}
