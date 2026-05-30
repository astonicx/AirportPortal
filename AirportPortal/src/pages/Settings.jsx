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

    const deleteAccount = async () => {
        if (!confirm("Permanently delete your account?")) return;
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
                    Auto-logout (minutes; 0 = off)
                    <input type="number" value={form.auto_logout_minutes} onChange={set("auto_logout_minutes")}
                        className="mt-1 w-full rounded border px-3 py-2" />
                </label>
                {msg && <p className="sm:col-span-2 text-green-700">{msg}</p>}
                {err && <p className="sm:col-span-2 text-destructive">{err.message}</p>}
                <button className="sm:col-span-2 rounded bg-milwaukeeBlue px-4 py-2 text-white">Save</button>
            </form>

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
