import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AdminAdmins() {
    const [list, setList] = useState([]);
    const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "" });
    const [err, setErr] = useState(null);

    const load = () => api.get("/api/admin/admins").then(setList).catch(() => { });
    useEffect(load, []);

    const create = async (e) => {
        e.preventDefault();
        setErr(null);
        try {
            await api.post("/api/admin/admins", form);
            setForm({ first_name: "", last_name: "", email: "", password: "" });
            load();
        } catch (e) { setErr(e); }
    };

    const remove = async (id) => {
        if (!confirm("Delete admin?")) return;
        await api.del(`/api/admin/admins/${id}`);
        load();
    };

    return (
        <div className="space-y-6">
            <section>
                <h2 className="text-lg font-semibold">Existing admins</h2>
                <ul className="divide-y rounded border">
                    {list.map((a) => (
                        <li key={a.id} className="flex justify-between p-3 text-sm">
                            <span>{a.first_name} {a.last_name} · {a.email} <span className="text-muted-foreground">({a.type})</span></span>
                            {a.type !== "root" && (
                                <button onClick={() => remove(a.id)} className="text-destructive underline">Delete</button>
                            )}
                        </li>
                    ))}
                </ul>
            </section>
            <section>
                <h2 className="text-lg font-semibold">Create admin</h2>
                <form onSubmit={create} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {["first_name", "last_name", "email", "password"].map((k) => (
                        <label key={k} className="block text-sm">
                            {k}
                            <input
                                type={k === "password" ? "password" : k === "email" ? "email" : "text"}
                                required value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                                className="mt-1 w-full rounded border px-3 py-2"
                            />
                        </label>
                    ))}
                    {err && <p className="sm:col-span-2 text-destructive">{err.data?.error || err.message}</p>}
                    <button className="sm:col-span-2 rounded bg-milwaukeeBlue px-4 py-2 text-white">Create</button>
                </form>
            </section>
        </div>
    );
}
