import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import PasswordStrengthMeter, { strengthOf } from "@/components/PasswordStrengthMeter";

export default function CompleteProfile() {
    const { user, refresh } = useAuth();
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [profile, setProfile] = useState({
        phone: "", address1: "", city: "", state: "", zip: "", country: "", dob: "", gender: "",
    });
    const [err, setErr] = useState(null);

    useEffect(() => {
        if (user && !user.mustChangePassword && !user.mustCompleteProfile) {
            navigate("/dashboard", { replace: true });
        }
    }, [user, navigate]);

    const set = (k) => (e) => setProfile({ ...profile, [k]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        setErr(null);
        if (user?.mustChangePassword && strengthOf(password).level === "weak") {
            setErr({ message: "Password must be at least 11 characters." });
            return;
        }
        try {
            await api.post("/api/me/complete", {
                password: user?.mustChangePassword ? password : undefined,
                profile: user?.mustCompleteProfile ? profile : undefined,
            });
            await refresh();
            navigate("/dashboard");
        } catch (e) { setErr(e); }
    };

    return (
        <div className="animate-in-up mx-auto max-w-xl space-y-5">
            <div className="space-y-1">
                <p className="page-eyebrow">Getting started</p>
                <h1>Complete your account</h1>
            </div>
            <form onSubmit={submit} className="form-card space-y-4">
                {user?.mustChangePassword && (
                    <>
                        <label className="field-label">
                            New password
                            <input type="password" required value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="field-input" />
                        </label>
                        <PasswordStrengthMeter password={password} />
                    </>
                )}
                {user?.mustCompleteProfile && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {Object.keys(profile).map((k) => (
                            <label key={k} className="field-label capitalize">
                                {k}
                                <input value={profile[k]} onChange={set(k)}
                                    className="field-input" />
                            </label>
                        ))}
                    </div>
                )}
                {err && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err.message}</p>}
                <button className="btn-primary w-full">Continue</button>
            </form>
        </div>
    );
}
