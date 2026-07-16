import { useState } from "react";
import { api } from "@/lib/api";
import PasswordStrengthMeter, { strengthOf } from "@/components/PasswordStrengthMeter";

export default function Recover() {
    const [step, setStep] = useState(1);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [dob, setDob] = useState("");
    const [userId, setUserId] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState([]);
    const [resetToken, setResetToken] = useState(null);
    const [newPassword, setNewPassword] = useState("");
    const [error, setError] = useState(null);
    const [done, setDone] = useState(false);

    async function init(e) {
        e.preventDefault();
        setError(null);
        try {
            const r = await api.post("/api/auth/recover/init", { firstName, lastName, dob });
            setUserId(r.userId);
            setQuestions(r.questions);
            setAnswers(r.questions.map(() => ""));
            setStep(2);
        } catch (err) {
            setError(err.data?.error || err.message);
        }
    }

    async function answer(e) {
        e.preventDefault();
        setError(null);
        try {
            const r = await api.post("/api/auth/recover/answer", {
                userId,
                answers,
            });
            setResetToken(r.resetToken);
            setStep(3);
        } catch (err) {
            setError(err.data?.error || err.message);
        }
    }

    async function reset(e) {
        e.preventDefault();
        setError(null);
        if (strengthOf(newPassword).level === "weak") {
            setError("Password must be at least 11 characters.");
            return;
        }
        try {
            await api.post("/api/auth/recover/reset", {
                resetToken,
                password: newPassword,
            });
            setDone(true);
        } catch (err) {
            setError(err.data?.error || err.message);
        }
    }

    if (done) {
        return (
            <div className="mx-auto max-w-md space-y-4">
                <h1 className="text-2xl font-bold">Password reset</h1>
                <p>You may now log in with your new password.</p>
                <a href="/login" className="underline">Go to login</a>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-md space-y-4">
            <h1 className="text-2xl font-bold">Recover account</h1>
            {step === 1 && (
                <form onSubmit={init} className="space-y-3">
                    <label className="block text-sm">
                        First name
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                            autoComplete="given-name"
                            className="mt-1 w-full rounded border px-3 py-2"
                        />
                    </label>
                    <label className="block text-sm">
                        Last name
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                            autoComplete="family-name"
                            className="mt-1 w-full rounded border px-3 py-2"
                        />
                    </label>
                    <label className="block text-sm">
                        Date of birth (YYYY-MM-DD)
                        <input
                            type="text"
                            value={dob}
                            onChange={(e) => setDob(e.target.value)}
                            required
                            placeholder="1990-05-15"
                            autoComplete="bday"
                            className="mt-1 w-full rounded border px-3 py-2"
                        />
                    </label>
                    <button className="w-full rounded bg-milwaukeeBlue px-4 py-2 text-white">
                        Continue
                    </button>
                </form>
            )}
            {step === 2 && (
                <form onSubmit={answer} className="space-y-3">
                    {questions.map((q, i) => (
                        <label key={i} className="block text-sm">
                            {q}
                            <input
                                type="text"
                                value={answers[i]}
                                onChange={(e) => {
                                    const next = [...answers];
                                    next[i] = e.target.value;
                                    setAnswers(next);
                                }}
                                required
                                className="mt-1 w-full rounded border px-3 py-2"
                            />
                        </label>
                    ))}
                    <button className="w-full rounded bg-milwaukeeBlue px-4 py-2 text-white">
                        Verify
                    </button>
                </form>
            )}
            {step === 3 && (
                <form onSubmit={reset} className="space-y-3">
                    <label className="block text-sm">
                        New password
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            className="mt-1 w-full rounded border px-3 py-2"
                        />
                    </label>
                    <PasswordStrengthMeter password={newPassword} />
                    <button className="w-full rounded bg-milwaukeeBlue px-4 py-2 text-white">
                        Reset password
                    </button>
                </form>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
