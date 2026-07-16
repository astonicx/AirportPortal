import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Spinner from "@/components/Spinner";

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
        <div className="mx-auto max-w-2xl space-y-6">
            <h1 className="text-2xl font-bold">Settings</h1>
            <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                    ["Email", "email", "email"],
                    ["Phone", "phone"], ["Address", "address1"], ["City", "city"],
                    ["State", "state"], ["ZIP", "zip"], ["Country", "country"],
                    ["Default sort", "default_sort"],
                ].map(([label, key, type = "text"]) => (
                    <label key={key} className="block text-sm">
                        {label}
                        <input type={type} value={form[key]} onChange={set(key)}
                            className="mt-1 w-full rounded border px-3 py-2" />
                    </label>
                ))}
                <label className="block text-sm">
                    Auto-logout
                    <select value={form.auto_logout_minutes} onChange={set("auto_logout_minutes")}
                        className="mt-1 w-full rounded border px-3 py-2">
                        <option value={0}>Off</option>
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={60}>1 hour</option>
                    </select>
                </label>
                {msg && <p className="sm:col-span-2 text-green-700">{msg}</p>}
                {err && <p className="sm:col-span-2 text-destructive">{err.message}</p>}
                <button className="sm:col-span-2 rounded bg-milwaukeeBlue px-4 py-2 text-white">Save</button>
            </form>

            <section>
                <h2 className="text-lg font-semibold">Claim a ticket</h2>
                <p className="text-sm text-muted-foreground">
                    Booked as a guest? Add an existing ticket to your account.
                </p>
                <form onSubmit={claimTicket} className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block text-sm">
                        Passenger last name
                        <input type="text" required value={claim.lastName}
                            onChange={(e) => setClaim({ ...claim, lastName: e.target.value })}
                            className="mt-1 w-full rounded border px-3 py-2" />
                    </label>
                    <label className="block text-sm">
                        Confirmation code
                        <input type="text" required value={claim.confirmation}
                            onChange={(e) => setClaim({ ...claim, confirmation: e.target.value })}
                            className="mt-1 w-full rounded border px-3 py-2" />
                    </label>
                    {claimMsg && <p className="sm:col-span-2 text-green-700">{claimMsg}</p>}
                    {claimErr && <p className="sm:col-span-2 text-destructive">{claimErr.data?.error || claimErr.message}</p>}
                    <button className="sm:col-span-2 rounded bg-milwaukeeBlue px-4 py-2 text-white">Claim ticket</button>
                </form>
            </section>

            <section>
                <h2 className="text-lg font-semibold">Saved cards</h2>
                <ul className="divide-y rounded border">
                    {cards.length === 0 && <li className="p-3 text-muted-foreground">None.</li>}
                    {cards.map((c) => (
                        <li key={c.id} className="flex justify-between p-3 text-sm">
                            <span>•••• {c.last4} · exp {c.exp_month}/{c.exp_year} · {c.cardholder_name}</span>
                            <button onClick={() => removeCard(c.id)} className="text-destructive underline">Remove</button>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="rounded border border-destructive p-4">
                <h2 className="font-semibold">Danger zone</h2>
                <button onClick={deleteAccount} className="mt-2 rounded border border-destructive px-3 py-1 text-destructive">
                    Delete my account
                </button>
            </section>
        </div>
    );
}
