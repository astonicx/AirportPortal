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
            <div className="animate-in-up mx-auto max-w-md py-12">
                <div className="form-card space-y-4 text-center">
                    <p className="page-eyebrow">Account recovery</p>
                    <h1>Password reset</h1>
                    <p className="text-sm text-muted-foreground">You may now log in with your new password.</p>
                    <a href="/login" className="btn-primary w-full">Go to login</a>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in-up mx-auto max-w-md space-y-6">
            <div className="space-y-1 text-center">
                <p className="page-eyebrow">Step {step} of 3</p>
                <h1>Recover account</h1>
            </div>
            {step === 1 && (
                <form onSubmit={init} className="form-card space-y-4">
                    <label className="field-label">
                        First name
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                            autoComplete="given-name"
                            className="field-input"
                        />
                    </label>
                    <label className="field-label">
                        Last name
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                            autoComplete="family-name"
                            className="field-input"
                        />
                    </label>
                    <label className="field-label">
                        Date of birth (YYYY-MM-DD)
                        <input
                            type="text"
                            value={dob}
                            onChange={(e) => setDob(e.target.value)}
                            required
                            placeholder="1990-05-15"
                            autoComplete="bday"
                            className="field-input"
                        />
                    </label>
                    <button className="btn-primary w-full">
                        Continue
                    </button>
                </form>
            )}
            {step === 2 && (
                <form onSubmit={answer} className="form-card space-y-4">
                    {questions.map((q, i) => (
                        <label key={i} className="field-label">
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
                                className="field-input"
                            />
                        </label>
                    ))}
                    <button className="btn-primary w-full">
                        Verify
                    </button>
                </form>
            )}
            {step === 3 && (
                <form onSubmit={reset} className="form-card space-y-4">
                    <label className="field-label">
                        New password
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            className="field-input"
                        />
                    </label>
                    <PasswordStrengthMeter password={newPassword} />
                    <button className="btn-primary w-full">
                        Reset password
                    </button>
                </form>
            )}
            {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        </div>
    );
}
