import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        setError(null);
        if (strengthOf(form.password).level === "weak") {
            setError("Password must be at least 11 characters.");
            return;
        }
        if (captcha !== expected) {
            setError("Captcha incorrect.");
            return;
        }
        setBusy(true);
        try {
            await api.post("/api/auth/signup", {
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
            navigate("/login", { replace: true });
        } catch (err) {
            setError(err.data?.error || err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mx-auto max-w-2xl space-y-4">
            <h1 className="text-2xl font-bold">Create your account</h1>
            <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                            className="mt-1 w-full rounded border px-3 py-2"
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
                            className="mt-1 w-full rounded border px-3 py-2"
                        />
                    </label>
                    <PasswordStrengthMeter password={form.password} />
                </div>
                <fieldset className="sm:col-span-2 rounded border p-3">
                    <legend className="px-1 text-sm font-medium">Security questions</legend>
                    {sq.map((q, i) => (
                        <div key={i} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <select
                                value={q.question}
                                onChange={(e) => {
                                    const next = [...sq];
                                    next[i] = { ...q, question: e.target.value };
                                    setSq(next);
                                }}
                                className="rounded border px-3 py-2"
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
                                className="rounded border px-3 py-2"
                            />
                        </div>
                    ))}
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
                    className="sm:col-span-2 rounded bg-milwaukeeBlue px-4 py-2 text-white disabled:opacity-60"
                >
                    {busy ? "Creating…" : "Create account"}
                </button>
            </form>
        </div>
    );
}
