import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import Captcha from "@/components/Captcha";
import PasswordStrengthMeter, { strengthOf } from "@/components/PasswordStrengthMeter";

const QUESTIONS = [
    "What is your mother's maiden name?",
    "What is the name of your first pet?",
    "What city were you born in?",
    "What is the name of your elementary school?",
    "What is your favorite book?",
];

export default function Signup() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        firstName: "",
        middleName: "",
        lastName: "",
        email: "",
        password: "",
        dob: "",
        gender: "",
        phone: "",
        address1: "",
        city: "",
        state: "",
        zip: "",
        country: "",
        loginDisambiguator: "",
    });
    const [sq, setSq] = useState([
        { question: QUESTIONS[0], answer: "" },
        { question: QUESTIONS[1], answer: "" },
        { question: QUESTIONS[2], answer: "" },
    ]);
    const [captcha, setCaptcha] = useState("");
    const [expected, setExpected] = useState("");
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [success, setSuccess] = useState(null);

    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

    const addQuestion = () => {
        const used = new Set(sq.map((q) => q.question));
        const next = QUESTIONS.find((q) => !used.has(q)) || QUESTIONS[0];
        setSq([...sq, { question: next, answer: "" }]);
    };
    const removeQuestion = (i) => {
        if (sq.length <= 3) return; // minimum of 3 required
        setSq(sq.filter((_, idx) => idx !== i));
    };

    const submit = async (e) => {
        e.preventDefault();
        setError(null);
        if (strengthOf(form.password).level === "weak") {
            setError("Password must be at least 11 characters.");
            return;
        }
        if (sq.length < 3 || sq.some((q) => !q.answer.trim())) {
            setError("Please provide at least 3 security questions with answers.");
            return;
        }
        if (captcha !== expected) {
            setError("Captcha incorrect.");
            return;
        }
        setBusy(true);
        try {
            const r = await api.post("/api/auth/signup", {
                first_name: form.firstName,
                middle_name: form.middleName,
                last_name: form.lastName,
                email: form.email,
                password: form.password,
                dob: form.dob,
                gender: form.gender,
                phone: form.phone,
                address1: form.address1,
                city: form.city,
                state: form.state,
                zip: form.zip,
                country: form.country,
                securityQuestions: sq,
                captchaAnswer: captcha,
                captchaExpected: expected,
            });
            setSuccess({
                firstName: form.firstName,
                lastName: form.lastName,
                disambiguator: r.disambiguator || null,
            });
        } catch (err) {
            setError(err.data?.error || err.message);
        } finally {
            setBusy(false);
        }
    };

    if (success) {
        return (
            <div className="animate-in-up mx-auto max-w-md space-y-4">
                <div className="surface-card space-y-4 p-8 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-2xl text-success">
                        ✓
                    </div>
                    <h1>Account created</h1>
                    <p className="text-muted-foreground">
                        Welcome, {success.firstName} {success.lastName}! Your account is ready.
                    </p>
                    {success.disambiguator ? (
                        <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-left text-sm">
                            <p className="font-semibold">Another user shares your name.</p>
                            <p className="mt-1">
                                Your login <strong>disambiguator</strong> is{" "}
                                <span className="rounded bg-white px-2 py-0.5 font-mono text-base shadow-sm">
                                    {success.disambiguator}
                                </span>
                                . Keep it handy — you’ll need it to log in.
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Your name is unique, so no disambiguator is needed to log in.
                        </p>
                    )}
                    <Link
                        to="/login"
                        className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground shadow-sm transition-all hover:shadow-md hover:brightness-110"
                    >
                        Go to login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in-up mx-auto max-w-2xl space-y-4">
            <div className="space-y-1">
                <h1>Create your account</h1>
                <p className="text-sm text-muted-foreground">
                    Join AirportPortal to book and manage your flights.
                </p>
            </div>
            <form onSubmit={submit} className="surface-card grid grid-cols-1 gap-3 p-6 sm:grid-cols-2">
                {[
                    ["First name", "firstName", "given-name", true],
                    ["Middle name", "middleName", "additional-name", false],
                    ["Last name", "lastName", "family-name", true],
                    ["Disambiguator (if name taken)", "loginDisambiguator", "off", false],
                    ["Email", "email", "email", true, "email"],
                    ["Date of birth (YYYY-MM-DD)", "dob", "bday", true],
                    ["Gender", "gender", "sex", true],
                    ["Phone", "phone", "tel", false],
                    ["Address", "address1", "street-address", false],
                    ["City", "city", "address-level2", false],
                    ["State", "state", "address-level1", false],
                    ["ZIP", "zip", "postal-code", false],
                    ["Country", "country", "country-name", false],
                ].map(([label, key, ac, req, type = "text"]) => (
                    <label key={key} className="block text-sm">
                        {label}
                        {req && <span className="text-destructive"> *</span>}
                        <input
                            type={type}
                            value={form[key]}
                            onChange={set(key)}
                            required={req}
                            autoComplete={ac}
                            className="field-input"
                        />
                    </label>
                ))}
                <div className="sm:col-span-2 space-y-1">
                    <label className="block text-sm">
                        Password <span className="text-destructive">*</span>
                        <input
                            type="password"
                            value={form.password}
                            onChange={set("password")}
                            required
                            autoComplete="new-password"
                            className="field-input"
                        />
                    </label>
                    <PasswordStrengthMeter password={form.password} />
                </div>
                <fieldset className="sm:col-span-2 rounded border p-3">
                    <legend className="px-1 text-sm font-medium">
                        Security questions (minimum 3)
                    </legend>
                    {sq.map((q, i) => (
                        <div key={i} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                            <select
                                value={q.question}
                                onChange={(e) => {
                                    const next = [...sq];
                                    next[i] = { ...q, question: e.target.value };
                                    setSq(next);
                                }}
                                className="field-input"
                            >
                                {QUESTIONS.map((qq) => (
                                    <option key={qq} value={qq}>{qq}</option>
                                ))}
                            </select>
                            <input
                                type="text"
                                placeholder="Answer"
                                value={q.answer}
                                onChange={(e) => {
                                    const next = [...sq];
                                    next[i] = { ...q, answer: e.target.value };
                                    setSq(next);
                                }}
                                required
                                className="field-input"
                            />
                            <button
                                type="button"
                                onClick={() => removeQuestion(i)}
                                disabled={sq.length <= 3}
                                className="field-input text-sm text-destructive disabled:opacity-40"
                                aria-label="Remove security question"
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addQuestion}
                        className="mt-3 rounded border px-3 py-1 text-sm"
                    >
                        + Add question
                    </button>
                </fieldset>
                <div className="sm:col-span-2">
                    <Captcha value={captcha} onChange={setCaptcha} onChallengeChange={setExpected} />
                </div>
                {error && (
                    <p role="alert" className="sm:col-span-2 text-sm text-destructive">
                        {error}
                    </p>
                )}
                <button
                    type="submit"
                    disabled={busy}
                    className="sm:col-span-2 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-60"
                >
                    {busy && (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    )}
                    {busy ? "Creating…" : "Create account"}
                </button>
            </form>
        </div>
    );
}
