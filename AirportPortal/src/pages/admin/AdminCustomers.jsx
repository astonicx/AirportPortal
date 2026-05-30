import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AdminCustomers() {
    const [q, setQ] = useState("");
    const [list, setList] = useState([]);

    const load = () => {
        api.get(`/api/admin/customers?q=${encodeURIComponent(q)}`).then(setList).catch(() => { });
    };
    useEffect(load, [q]);

    const remove = async (id) => {
        if (!confirm("Delete customer?")) return;
        await api.del(`/api/admin/customers/${id}`);
        load();
    };

    return (
        <div className="space-y-3">
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
                            <td className="px-3 py-2 text-right">
                                <button onClick={() => remove(c.id)} className="text-destructive underline">Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
