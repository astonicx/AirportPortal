import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Spinner from "@/components/Spinner";

const SunIcon = (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
);
const MoonIcon = (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
);
const SystemIcon = (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
    </svg>
);

const THEME_OPTIONS = [
    { value: "light", label: "Light", Icon: SunIcon },
    { value: "dark", label: "Dark", Icon: MoonIcon },
    { value: "system", label: "System", Icon: SystemIcon },
];

function Appearance() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    return (
        <section className="form-card space-y-3">
            <div>
                <h2 className="text-lg font-semibold">Appearance</h2>
                <p className="text-sm text-muted-foreground">
                    Choose how AirportPortal looks on this device.
                </p>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
                {THEME_OPTIONS.map(({ value, label, Icon }) => {
                    const active = mounted && theme === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setTheme(value)}
                            aria-pressed={active}
                            className={`group flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm font-medium transition-all ${active
                                ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30"
                                : "border-border bg-background text-muted-foreground hover:-translate-y-0.5 hover:border-primary/50 hover:text-foreground hover:shadow-card"
                                }`}
                        >
                            <Icon className="h-5 w-5" aria-hidden />
                            {label}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

export default function Settings() {
    const { user, refresh } = useAuth();
    const [form, setForm] = useState({
        email: "", phone: "", address1: "", city: "", state: "", zip: "", country: "",
        default_sort: "time", auto_logout_minutes: 0,
    });
    const [cards, setCards] = useState([]);
    const [msg, setMsg] = useState(null);
    const [err, setErr] = useState(null);
    const [claim, setClaim] = useState({ lastName: "", confirmation: "" });
    const [claimMsg, setClaimMsg] = useState(null);
    const [claimErr, setClaimErr] = useState(null);

    useEffect(() => {
        if (user) {
            setForm((f) => ({
                ...f,
                email: user.email || "",
                default_sort: user.defaultSort || "time",
                auto_logout_minutes: user.autoLogoutMinutes || 0,
            }));
        }
        api.get("/api/me/cards").then(setCards).catch(() => { });
    }, [user]);

    const set = (k) => (e) =>
        setForm({ ...form, [k]: e.target.type === "number" ? +e.target.value : e.target.value });

    const save = async (e) => {
        e.preventDefault();
        setMsg(null); setErr(null);
        try {
            await api.patch("/api/me", form);
            await refresh();
            setMsg("Saved.");
        } catch (e) { setErr(e); }
    };

    const removeCard = async (id) => {
        await api.del(`/api/me/cards/${id}`);
        setCards(cards.filter((c) => c.id !== id));
    };

    const claimTicket = async (e) => {
        e.preventDefault();
        setClaimMsg(null); setClaimErr(null);
        try {
            await api.post("/api/me/claim-ticket", claim);
            setClaimMsg("Ticket claimed and added to your account.");
            setClaim({ lastName: "", confirmation: "" });
        } catch (e) { setClaimErr(e); }
    };

    const deleteAccount = async () => {
        if (!confirm("Permanently delete your account? This cannot be undone.")) return;
        if (!confirm("Are you absolutely sure? All your tickets and data will be erased.")) return;
        await api.del("/api/me");
        window.location.href = "/";
    };

    if (!user) return <Spinner />;

    return (
        <div className="animate-in-up mx-auto max-w-2xl space-y-8">
            <div className="space-y-1">
                <p className="page-eyebrow">Your account</p>
                <h1>Settings</h1>
            </div>
            <Appearance />
            <form onSubmit={save} className="form-card grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                    ["Email", "email", "email"],
                    ["Phone", "phone"], ["Address", "address1"], ["City", "city"],
                    ["State", "state"], ["ZIP", "zip"], ["Country", "country"],
                    ["Default sort", "default_sort"],
                ].map(([label, key, type = "text"]) => (
                    <label key={key} className="field-label">
                        {label}
                        <input type={type} value={form[key]} onChange={set(key)}
                            className="field-input" />
                    </label>
                ))}
                <label className="field-label">
                    Auto-logout
                    <select value={form.auto_logout_minutes} onChange={set("auto_logout_minutes")}
                        className="field-input">
                        <option value={0}>Off</option>
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={60}>1 hour</option>
                    </select>
                </label>
                {msg && <p className="sm:col-span-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{msg}</p>}
                {err && <p className="sm:col-span-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err.message}</p>}
                <button className="btn-primary sm:col-span-2">Save changes</button>
            </form>

            <section className="form-card space-y-3">
                <div>
                    <h2 className="text-lg font-semibold">Claim a ticket</h2>
                    <p className="text-sm text-muted-foreground">
                        Booked as a guest? Add an existing ticket to your account.
                    </p>
                </div>
                <form onSubmit={claimTicket} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="field-label">
                        Passenger last name
                        <input type="text" required value={claim.lastName}
                            onChange={(e) => setClaim({ ...claim, lastName: e.target.value })}
                            className="field-input" />
                    </label>
                    <label className="field-label">
                        Confirmation code
                        <input type="text" required value={claim.confirmation}
                            onChange={(e) => setClaim({ ...claim, confirmation: e.target.value })}
                            className="field-input font-mono tracking-wider" />
                    </label>
                    {claimMsg && <p className="sm:col-span-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{claimMsg}</p>}
                    {claimErr && <p className="sm:col-span-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{claimErr.data?.error || claimErr.message}</p>}
                    <button className="btn-primary sm:col-span-2">Claim ticket</button>
                </form>
            </section>

            <section className="form-card space-y-3">
                <h2 className="text-lg font-semibold">Saved cards</h2>
                <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/70">
                    {cards.length === 0 && <li className="p-3 text-sm text-muted-foreground">None.</li>}
                    {cards.map((c) => (
                        <li key={c.id} className="flex justify-between p-3 text-sm">
                            <span>•••• {c.last4} · exp {c.exp_month}/{c.exp_year} · {c.cardholder_name}</span>
                            <button onClick={() => removeCard(c.id)} className="font-medium text-destructive hover:underline">Remove</button>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
                <h2 className="font-semibold text-destructive">Danger zone</h2>
                <p className="mt-1 text-sm text-muted-foreground">Permanently remove your account and all associated data.</p>
                <button onClick={deleteAccount} className="mt-3 rounded-lg border border-destructive px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground">
                    Delete my account
                </button>
            </section>
        </div>
    );
}
