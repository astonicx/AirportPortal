import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AdminTickets() {
    const [q, setQ] = useState("");
    const [list, setList] = useState([]);

    const load = () => {
        api.get(`/api/admin/tickets?q=${encodeURIComponent(q)}`).then(setList).catch(() => { });
    };
    useEffect(load, [q]);

    const cancel = async (id) => {
        if (!confirm("Cancel this ticket?")) return;
        await api.post(`/api/admin/tickets/${id}/cancel`, {});
        load();
    };

    return (
        <div className="space-y-3">
            <input
                type="search" placeholder="Search…" value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full max-w-md field-input"
            />
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-secondary">
                        <tr>
                            <th className="px-3 py-2 text-left">Code</th>
                            <th className="px-3 py-2 text-left">Passenger</th>
                            <th className="px-3 py-2 text-left">Flight</th>
                            <th className="px-3 py-2 text-left">Seat</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {list.map((t) => (
                            <tr key={t.id} className="border-t">
                                <td className="px-3 py-2">{t.confirmation_code}</td>
                                <td className="px-3 py-2">{t.passenger_first} {t.passenger_last}</td>
                                <td className="px-3 py-2">{t.flight_id}</td>
                                <td className="px-3 py-2">{t.seat}</td>
                                <td className="px-3 py-2">{t.status}</td>
                                <td className="px-3 py-2 text-right">
                                    {t.status === "active" && (
                                        <button onClick={() => cancel(t.id)} className="text-destructive underline">
                                            Cancel
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
