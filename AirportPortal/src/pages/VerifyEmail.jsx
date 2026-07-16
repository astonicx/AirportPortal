import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";

// Public page a customer lands on from their account-confirmation link.
// Reads ?token=… and confirms the account so they can log in.
export default function VerifyEmail() {
    const [params] = useSearchParams();
    const token = params.get("token") || "";
    const [status, setStatus] = useState(token ? "pending" : "missing");
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!token) return;
        let active = true;
        api
            .post("/api/auth/verify-email", { token })
            .then(() => active && setStatus("ok"))
            .catch((err) => {
                if (!active) return;
                setError(err.data?.error || err.message);
                setStatus("error");
            });
        return () => {
            active = false;
        };
    }, [token]);

    return (
        <div className="animate-in-up mx-auto max-w-md py-16">
            <div className="form-card space-y-4 text-center">
                <p className="page-eyebrow">Account</p>
                <h1>Account verification</h1>
                {status === "missing" && (
                    <p className="text-destructive">No verification token provided.</p>
                )}
                {status === "pending" && (
                    <p className="flex items-center justify-center gap-2 text-muted-foreground">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Confirming your account…
                    </p>
                )}
                {status === "ok" && (
                    <>
                        <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                            Your account is verified. You can now log in.
                        </p>
                        <Link to="/login" className="btn-primary w-full">
                            Go to login
                        </Link>
                    </>
                )}
                {status === "error" && (
                    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
}
