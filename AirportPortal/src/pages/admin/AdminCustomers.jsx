import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const EMPTY_CREATE = { first_name: "", last_name: "", email: "", password: "" };

export default function AdminCustomers() {
    const [q, setQ] = useState("");
    const [list, setList] = useState([]);

    const [create, setCreate] = useState(EMPTY_CREATE);
    const [createErr, setCreateErr] = useState(null);
    const [createdLink, setCreatedLink] = useState(null);

    const [editing, setEditing] = useState(null);
    const [editErr, setEditErr] = useState(null);

    // Per-customer airline restrictions (v2, tied to a real account).
    const [restrictFor, setRestrictFor] = useState(null);
    const [restrictions, setRestrictions] = useState([]);
    const [restriction, setRestriction] = useState({ airline: "", reason: "" });
    const [restrictErr, setRestrictErr] = useState(null);

    // Legacy free-text airline bans (identity + airline), enforced at booking.
    const [bans, setBans] = useState([]);
    const [ban, setBan] = useState({ identity: "", airline: "" });
    const [banErr, setBanErr] = useState(null);

    const load = () => {
        api
            .get(`/api/admin/customers?q=${encodeURIComponent(q)}`)
            .then(setList)
            .catch(() => { });
    };
    useEffect(load, [q]);

    const loadBans = () => {
        api.get("/api/admin/airline-bans").then(setBans).catch(() => { });
    };
    useEffect(loadBans, []);

    const submitCreate = async (e) => {
        e.preventDefault();
        setCreateErr(null);
        setCreatedLink(null);
        try {
            const res = await api.post("/api/admin/customers", create);
            setCreate(EMPTY_CREATE);
            setCreatedLink(res?.verificationUrl || null);
            load();
        } catch (err) {
            setCreateErr(err);
        }
    };

    const remove = async (id) => {
        if (!confirm("Delete customer?")) return;
        await api.del(`/api/admin/customers/${id}`);
        load();
    };

    const saveEdit = async (e) => {
        e.preventDefault();
        setEditErr(null);
        try {
            const { id, first_name, last_name, email, phone } = editing;
            await api.patch(`/api/admin/customers/${id}`, {
                first_name,
                last_name,
                email,
                phone,
            });
            setEditing(null);
            load();
        } catch (err) {
            setEditErr(err);
        }
    };

    const banCustomer = async (c) => {
        const reason = prompt(`Ban ${c.first_name} ${c.last_name} from the application. Reason:`);
        if (reason == null || reason.trim() === "") return;
        await api.post(`/api/admin/customers/${c.id}/ban`, { reason: reason.trim() });
        load();
    };

    const unbanCustomer = async (c) => {
        if (!confirm(`Unban ${c.first_name} ${c.last_name}?`)) return;
        await api.post(`/api/admin/customers/${c.id}/unban`, {});
        load();
    };

    const resendVerification = async (c) => {
        const res = await api.post(`/api/admin/customers/${c.id}/resend-verification`, {});
        if (res?.verificationUrl) {
            setCreatedLink(res.verificationUrl);
        }
    };

    const openRestrictions = (c) => {
        setRestrictFor(c);
        setRestriction({ airline: "", reason: "" });
        setRestrictErr(null);
        api
            .get(`/api/admin/airline-restrictions?user_id=${c.id}`)
            .then(setRestrictions)
            .catch(() => setRestrictions([]));
    };

    const addRestriction = async (e) => {
        e.preventDefault();
        setRestrictErr(null);
        try {
            await api.post("/api/admin/airline-restrictions", {
                user_id: restrictFor.id,
                airline: restriction.airline,
                reason: restriction.reason,
            });
            setRestriction({ airline: "", reason: "" });
            const rows = await api.get(
                `/api/admin/airline-restrictions?user_id=${restrictFor.id}`
            );
            setRestrictions(rows);
        } catch (err) {
            setRestrictErr(err);
        }
    };

    const removeRestriction = async (id) => {
        await api.del(`/api/admin/airline-restrictions/${id}`);
        const rows = await api.get(
            `/api/admin/airline-restrictions?user_id=${restrictFor.id}`
        );
        setRestrictions(rows);
    };

    const addBan = async (e) => {
        e.preventDefault();
        setBanErr(null);
        try {
            await api.post("/api/admin/airline-bans", ban);
            setBan({ identity: "", airline: "" });
            loadBans();
        } catch (err) {
            setBanErr(err);
        }
    };

    const removeBan = async (id) => {
        await api.del(`/api/admin/airline-bans/${id}`);
        loadBans();
    };

    return (
        <div className="space-y-8">
            <section className="space-y-3">
                <h2 className="text-lg font-semibold">Customers</h2>
                <form
                    onSubmit={submitCreate}
                    className="grid grid-cols-1 gap-2 rounded border p-3 sm:grid-cols-4"
                >
                    <input
                        required
                        placeholder="First name"
                        value={create.first_name}
                        onChange={(e) => setCreate({ ...create, first_name: e.target.value })}
                        className="field-input"
                    />
                    <input
                        required
                        placeholder="Last name"
                        value={create.last_name}
                        onChange={(e) => setCreate({ ...create, last_name: e.target.value })}
                        className="field-input"
                    />
                    <input
                        required
                        type="email"
                        placeholder="Email"
                        value={create.email}
                        onChange={(e) => setCreate({ ...create, email: e.target.value })}
                        className="field-input"
                    />
                    <input
                        required
                        type="password"
                        placeholder="Temp password (11+ chars)"
                        value={create.password}
                        onChange={(e) => setCreate({ ...create, password: e.target.value })}
                        className="field-input"
                    />
                    {createErr && (
                        <p className="sm:col-span-4 text-destructive">
                            {createErr.data?.error || createErr.message}
                        </p>
                    )}
                    {createdLink && (
                        <p className="sm:col-span-4 text-sm text-success">
                            Account created (unverified). Confirmation link:{" "}
                            <a href={createdLink} className="underline break-all">
                                {createdLink}
                            </a>
                        </p>
                    )}
                    <button className="sm:col-span-4 btn-primary">
                        Add customer
                    </button>
                </form>

                <input
                    type="search"
                    placeholder="Search…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="w-full max-w-md field-input"
                />
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-secondary">
                            <tr>
                                <th className="px-3 py-2 text-left">Name</th>
                                <th className="px-3 py-2 text-left">Email</th>
                                <th className="px-3 py-2 text-left">Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.map((c) => {
                                const banned = Number(c.is_banned) === 1;
                                const verified = Number(c.email_verified) === 1;
                                return (
                                    <tr key={c.id} className="border-t align-top">
                                        <td className="px-3 py-2">
                                            {c.first_name} {c.last_name}
                                        </td>
                                        <td className="px-3 py-2">{c.email}</td>
                                        <td className="px-3 py-2 space-x-1">
                                            {banned ? (
                                                <span
                                                    className="rounded bg-destructive px-2 py-0.5 text-xs text-destructive-foreground"
                                                    title={c.banned_reason || ""}
                                                >
                                                    Banned
                                                </span>
                                            ) : (
                                                <span className="pill pill-success">
                                                    Active
                                                </span>
                                            )}
                                            {verified ? (
                                                <span className="pill pill-success">
                                                    Verified
                                                </span>
                                            ) : (
                                                <span className="pill pill-warning">
                                                    Unverified
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right space-x-3 whitespace-nowrap">
                                            <button
                                                onClick={() => openRestrictions(c)}
                                                className="underline"
                                            >
                                                Restrictions
                                            </button>
                                            {!verified && (
                                                <button
                                                    onClick={() => resendVerification(c)}
                                                    className="underline"
                                                >
                                                    Resend link
                                                </button>
                                            )}
                                            {banned ? (
                                                <button
                                                    onClick={() => unbanCustomer(c)}
                                                    className="underline"
                                                >
                                                    Unban
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => banCustomer(c)}
                                                    className="text-destructive underline"
                                                >
                                                    Ban
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setEditing({ ...c })}
                                                className="underline"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => remove(c.id)}
                                                className="text-destructive underline"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="space-y-3">
                <h2 className="text-lg font-semibold">Airline bans (passenger identity)</h2>
                <p className="text-sm text-muted-foreground">
                    Blocks a passenger identity (name + DOB) from a specific airline at booking
                    time, even without an account.
                </p>
                <form
                    onSubmit={addBan}
                    className="grid grid-cols-1 gap-2 rounded border p-3 sm:grid-cols-3"
                >
                    <input
                        required
                        placeholder="User / passenger identity"
                        value={ban.identity}
                        onChange={(e) => setBan({ ...ban, identity: e.target.value })}
                        className="field-input"
                    />
                    <input
                        required
                        placeholder="Airline"
                        value={ban.airline}
                        onChange={(e) => setBan({ ...ban, airline: e.target.value })}
                        className="field-input"
                    />
                    <button className="btn-primary">
                        Add ban
                    </button>
                    {banErr && (
                        <p className="sm:col-span-3 text-destructive">
                            {banErr.data?.error || banErr.message}
                        </p>
                    )}
                </form>
                <ul className="divide-y rounded border">
                    {bans.length === 0 && (
                        <li className="p-3 text-muted-foreground">No bans.</li>
                    )}
                    {bans.map((b) => (
                        <li key={b.id} className="flex justify-between p-3 text-sm">
                            <span>
                                {b.user_or_passenger_identity} · {b.airline}
                            </span>
                            <button
                                onClick={() => removeBan(b.id)}
                                className="text-destructive underline"
                            >
                                Remove
                            </button>
                        </li>
                    ))}
                </ul>
            </section>

            {editing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <form
                        onSubmit={saveEdit}
                        className="w-full max-w-md space-y-3 rounded bg-background p-5 shadow-lg"
                    >
                        <h3 className="text-lg font-semibold">Edit customer</h3>
                        <input
                            placeholder="First name"
                            value={editing.first_name || ""}
                            onChange={(e) =>
                                setEditing({ ...editing, first_name: e.target.value })
                            }
                            className="w-full field-input"
                        />
                        <input
                            placeholder="Last name"
                            value={editing.last_name || ""}
                            onChange={(e) =>
                                setEditing({ ...editing, last_name: e.target.value })
                            }
                            className="w-full field-input"
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            value={editing.email || ""}
                            onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                            className="w-full field-input"
                        />
                        <input
                            placeholder="Phone"
                            value={editing.phone || ""}
                            onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                            className="w-full field-input"
                        />
                        {editErr && (
                            <p className="text-destructive">
                                {editErr.data?.error || editErr.message}
                            </p>
                        )}
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setEditing(null)}
                                className="rounded border px-4 py-2"
                            >
                                Cancel
                            </button>
                            <button className="btn-primary">
                                Save
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {restrictFor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md space-y-4 rounded bg-background p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">
                                Airline restrictions — {restrictFor.first_name}{" "}
                                {restrictFor.last_name}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setRestrictFor(null)}
                                className="text-muted-foreground underline"
                            >
                                Close
                            </button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Prevents this account from booking the listed airlines.
                        </p>
                        <form onSubmit={addRestriction} className="space-y-2">
                            <input
                                required
                                placeholder="Airline"
                                value={restriction.airline}
                                onChange={(e) =>
                                    setRestriction({ ...restriction, airline: e.target.value })
                                }
                                className="w-full field-input"
                            />
                            <input
                                required
                                placeholder="Reason"
                                value={restriction.reason}
                                onChange={(e) =>
                                    setRestriction({ ...restriction, reason: e.target.value })
                                }
                                className="w-full field-input"
                            />
                            {restrictErr && (
                                <p className="text-destructive">
                                    {restrictErr.data?.error || restrictErr.message}
                                </p>
                            )}
                            <button className="w-full btn-primary">
                                Add restriction
                            </button>
                        </form>
                        <ul className="divide-y rounded border">
                            {restrictions.length === 0 && (
                                <li className="p-3 text-sm text-muted-foreground">
                                    No restrictions.
                                </li>
                            )}
                            {restrictions.map((r) => (
                                <li
                                    key={r.id}
                                    className="flex items-center justify-between p-3 text-sm"
                                >
                                    <span>
                                        {r.airline}
                                        {r.reason ? ` · ${r.reason}` : ""}
                                    </span>
                                    <button
                                        onClick={() => removeRestriction(r.id)}
                                        className="text-destructive underline"
                                    >
                                        Remove
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
