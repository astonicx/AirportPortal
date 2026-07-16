import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const EMPTY_CREATE = { first_name: "", last_name: "", email: "", password: "" };

export default function AdminCustomers() {
    const [q, setQ] = useState("");
    const [list, setList] = useState([]);
    const [create, setCreate] = useState(EMPTY_CREATE);
    const [createErr, setCreateErr] = useState(null);
    const [editing, setEditing] = useState(null);
    const [editErr, setEditErr] = useState(null);

    const [bans, setBans] = useState([]);
    const [ban, setBan] = useState({ identity: "", airline: "" });
    const [banErr, setBanErr] = useState(null);

    const load = () => {
        api.get(`/api/admin/customers?q=${encodeURIComponent(q)}`).then(setList).catch(() => { });
    };
    useEffect(load, [q]);

    const loadBans = () => {
        api.get("/api/admin/airline-bans").then(setBans).catch(() => { });
    };
    useEffect(loadBans, []);

    const remove = async (id) => {
        if (!confirm("Delete customer?")) return;
        await api.del(`/api/admin/customers/${id}`);
        load();
    };

    const submitCreate = async (e) => {
        e.preventDefault();
        setCreateErr(null);
        try {
            await api.post("/api/admin/customers", create);
            setCreate(EMPTY_CREATE);
            load();
        } catch (err) { setCreateErr(err); }
    };

    const saveEdit = async (e) => {
        e.preventDefault();
        setEditErr(null);
        try {
            const { id, first_name, last_name, email, phone } = editing;
            await api.patch(`/api/admin/customers/${id}`, { first_name, last_name, email, phone });
            setEditing(null);
            load();
        } catch (err) { setEditErr(err); }
    };

    const addBan = async (e) => {
        e.preventDefault();
        setBanErr(null);
        try {
            await api.post("/api/admin/airline-bans", ban);
            setBan({ identity: "", airline: "" });
            loadBans();
        } catch (err) { setBanErr(err); }
    };

    const removeBan = async (id) => {
        await api.del(`/api/admin/airline-bans/${id}`);
        loadBans();
    };

    return (
        <div className="space-y-8">
            <section className="space-y-3">
                <h2 className="text-lg font-semibold">Customers</h2>
                <form onSubmit={submitCreate} className="grid grid-cols-1 gap-2 rounded border p-3 sm:grid-cols-4">
                    <input required placeholder="First name" value={create.first_name}
                        onChange={(e) => setCreate({ ...create, first_name: e.target.value })}
                        className="rounded border px-3 py-2" />
                    <input required placeholder="Last name" value={create.last_name}
                        onChange={(e) => setCreate({ ...create, last_name: e.target.value })}
                        className="rounded border px-3 py-2" />
                    <input required type="email" placeholder="Email" value={create.email}
                        onChange={(e) => setCreate({ ...create, email: e.target.value })}
                        className="rounded border px-3 py-2" />
                    <input required type="password" placeholder="Temp password" value={create.password}
                        onChange={(e) => setCreate({ ...create, password: e.target.value })}
                        className="rounded border px-3 py-2" />
                    {createErr && <p className="sm:col-span-4 text-destructive">{createErr.data?.error || createErr.message}</p>}
                    <button className="sm:col-span-4 rounded bg-milwaukeeBlue px-4 py-2 text-white">Add customer</button>
                </form>

                <input
                    type="search" placeholder="Search…" value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="w-full max-w-md rounded border px-3 py-2"
                />
                <table className="w-full text-sm">
                    <thead className="bg-secondary">
                        <tr>
                            <th className="px-3 py-2 text-left">Name</th>
                            <th className="px-3 py-2 text-left">Email</th>
                            <th className="px-3 py-2 text-left">Phone</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {list.map((c) => (
                            <tr key={c.id} className="border-t">
                                <td className="px-3 py-2">{c.first_name} {c.last_name}</td>
                                <td className="px-3 py-2">{c.email}</td>
                                <td className="px-3 py-2">{c.phone}</td>
                                <td className="px-3 py-2 text-right space-x-3">
                                    <button onClick={() => setEditing({ ...c })} className="underline">Edit</button>
                                    <button onClick={() => remove(c.id)} className="text-destructive underline">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section className="space-y-3">
                <h2 className="text-lg font-semibold">Airline bans</h2>
                <form onSubmit={addBan} className="grid grid-cols-1 gap-2 rounded border p-3 sm:grid-cols-3">
                    <input required placeholder="User / passenger identity" value={ban.identity}
                        onChange={(e) => setBan({ ...ban, identity: e.target.value })}
                        className="rounded border px-3 py-2" />
                    <input required placeholder="Airline" value={ban.airline}
                        onChange={(e) => setBan({ ...ban, airline: e.target.value })}
                        className="rounded border px-3 py-2" />
                    <button className="rounded bg-milwaukeeBlue px-4 py-2 text-white">Add ban</button>
                    {banErr && <p className="sm:col-span-3 text-destructive">{banErr.data?.error || banErr.message}</p>}
                </form>
                <ul className="divide-y rounded border">
                    {bans.length === 0 && <li className="p-3 text-muted-foreground">No bans.</li>}
                    {bans.map((b) => (
                        <li key={b.id} className="flex justify-between p-3 text-sm">
                            <span>{b.user_or_passenger_identity} · {b.airline}</span>
                            <button onClick={() => removeBan(b.id)} className="text-destructive underline">Remove</button>
                        </li>
                    ))}
                </ul>
            </section>

            {editing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <form onSubmit={saveEdit} className="w-full max-w-md space-y-3 rounded bg-background p-5 shadow-lg">
                        <h3 className="text-lg font-semibold">Edit customer</h3>
                        <input placeholder="First name" value={editing.first_name || ""}
                            onChange={(e) => setEditing({ ...editing, first_name: e.target.value })}
                            className="w-full rounded border px-3 py-2" />
                        <input placeholder="Last name" value={editing.last_name || ""}
                            onChange={(e) => setEditing({ ...editing, last_name: e.target.value })}
                            className="w-full rounded border px-3 py-2" />
                        <input type="email" placeholder="Email" value={editing.email || ""}
                            onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                            className="w-full rounded border px-3 py-2" />
                        <input placeholder="Phone" value={editing.phone || ""}
                            onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                            className="w-full rounded border px-3 py-2" />
                        {editErr && <p className="text-destructive">{editErr.data?.error || editErr.message}</p>}
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setEditing(null)} className="rounded border px-4 py-2">Cancel</button>
                            <button className="rounded bg-milwaukeeBlue px-4 py-2 text-white">Save</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
