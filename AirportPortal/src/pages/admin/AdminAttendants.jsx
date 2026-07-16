import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const EMPTY_CREATE = { email: "", password: "", airline: "" };

export default function AdminAttendants() {
    const { user } = useAuth();
    const isRoot = user?.type === "root";

    const [q, setQ] = useState("");
    const [list, setList] = useState([]);
    const [create, setCreate] = useState(EMPTY_CREATE);
    const [createErr, setCreateErr] = useState(null);

    const load = () => {
        api
            .get(`/api/admin/attendants?q=${encodeURIComponent(q)}`)
            .then(setList)
            .catch(() => { });
    };
    useEffect(load, [q]);

    const submitCreate = async (e) => {
        e.preventDefault();
        setCreateErr(null);
        try {
            await api.post("/api/admin/attendants", create);
            setCreate(EMPTY_CREATE);
            load();
        } catch (err) {
            setCreateErr(err);
        }
    };

    const remove = async (id) => {
        if (!confirm("Delete attendant?")) return;
        await api.del(`/api/admin/attendants/${id}`);
        load();
    };

    return (
        <div className="space-y-6">
            <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Airline attendants</h2>
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search name, email, airline…"
                        className="field-input max-w-xs"
                    />
                </div>
                <ul className="divide-y rounded border">
                    {list.length === 0 && (
                        <li className="p-3 text-sm text-muted-foreground">
                            No attendant accounts.
                        </li>
                    )}
                    {list.map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                            <span>
                                {a.first_name} {a.last_name} · {a.email}{" "}
                                <span className="text-muted-foreground">
                                    ({a.airline || "unassigned"})
                                </span>
                                {Number(a.is_banned) === 1 && (
                                    <span className="ml-2 text-destructive">banned</span>
                                )}
                            </span>
                            {isRoot && (
                                <button
                                    onClick={() => remove(a.id)}
                                    className="text-destructive underline"
                                >
                                    Delete
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </section>

            {isRoot && (
                <section>
                    <h2 className="text-lg font-semibold">Create attendant</h2>
                    <form onSubmit={submitCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block text-sm">
                            email
                            <input
                                type="email"
                                required
                                value={create.email}
                                onChange={(e) => setCreate({ ...create, email: e.target.value })}
                                className="field-input"
                            />
                        </label>
                        <label className="block text-sm">
                            password
                            <input
                                type="password"
                                required
                                value={create.password}
                                onChange={(e) => setCreate({ ...create, password: e.target.value })}
                                className="field-input"
                            />
                        </label>
                        <label className="block text-sm sm:col-span-2">
                            airline
                            <input
                                type="text"
                                required
                                value={create.airline}
                                onChange={(e) => setCreate({ ...create, airline: e.target.value })}
                                className="field-input"
                            />
                        </label>
                        {createErr && (
                            <p className="sm:col-span-2 text-destructive">
                                {createErr.data?.error || createErr.message}
                            </p>
                        )}
                        <button className="sm:col-span-2 btn-primary">Create attendant</button>
                    </form>
                </section>
            )}
        </div>
    );
}
