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
        <div className="mx-auto max-w-xl space-y-4">
            <h1 className="text-2xl font-bold">Complete your account</h1>
            <form onSubmit={submit} className="space-y-3">
                {user?.mustChangePassword && (
                    <>
                        <label className="block text-sm">
                            New password
                            <input type="password" required value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 w-full rounded border px-3 py-2" />
                        </label>
                        <PasswordStrengthMeter password={password} />
                    </>
                )}
                {user?.mustCompleteProfile && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {Object.keys(profile).map((k) => (
                            <label key={k} className="block text-sm">
                                {k}
                                <input value={profile[k]} onChange={set(k)}
                                    className="mt-1 w-full rounded border px-3 py-2" />
                            </label>
                        ))}
                    </div>
                )}
                {err && <p className="text-destructive">{err.message}</p>}
                <button className="rounded bg-milwaukeeBlue px-4 py-2 text-white">Continue</button>
            </form>
        </div>
    );
}
