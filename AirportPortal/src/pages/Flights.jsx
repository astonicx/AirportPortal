import { useState } from "react";
import { Link } from "react-router-dom";
import { useLiveResource } from "@/hooks/useLiveResource";
import Spinner from "@/components/Spinner";

const SORT_FIELDS = ["flightNumber", "airline", "airport", "city", "time", "gate"];

export default function Flights() {
    const [type, setType] = useState("departure");
    const [page, setPage] = useState(1);
    const [q, setQ] = useState("");
    const [sortBy, setSortBy] = useState("time");
    const [sortDir, setSortDir] = useState("asc");
    const path = `/api/flights?type=${type}&page=${page}&pageSize=20&q=${encodeURIComponent(q)}&sortBy=${sortBy}&sortDir=${sortDir}`;
    const { data, error, loading } = useLiveResource(path, { intervalMs: 60_000 });

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">Flights</h1>
            <div className="flex flex-wrap items-center gap-2">
                <select
                    value={type}
                    onChange={(e) => { setType(e.target.value); setPage(1); }}
                    className="rounded border px-3 py-2"
                >
                    <option value="departure">Departures</option>
                    <option value="arrival">Arrivals</option>
                </select>
                <input
                    type="search"
                    placeholder="Search…"
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setPage(1); }}
                    className="rounded border px-3 py-2"
                />
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="rounded border px-3 py-2"
                >
                    {SORT_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <button
                    onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
                    className="rounded border px-3 py-2"
                >
                    {sortDir === "asc" ? "▲" : "▼"}
                </button>
            </div>
            {loading && <Spinner />}
            {error && <p className="text-destructive">{error.message}</p>}
            {data && (
                <>
                    <div className="overflow-x-auto rounded border">
                        <table className="w-full text-sm">
                            <thead className="bg-secondary">
                                <tr>
                                    <th className="px-3 py-2 text-left">Flight</th>
                                    <th className="px-3 py-2 text-left">Airline</th>
                                    <th className="px-3 py-2 text-left">{type === "arrival" ? "From" : "To"}</th>
                                    <th className="px-3 py-2 text-left">Time</th>
                                    <th className="px-3 py-2 text-left">Gate</th>
                                    <th className="px-3 py-2 text-left">Status</th>
                                    <th className="px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map((f) => (
                                    <tr key={f.flight_id || f.id} className="border-t">
                                        <td className="px-3 py-2">{f.flightNumber}</td>
                                        <td className="px-3 py-2">{f.airline}</td>
                                        <td className="px-3 py-2">{f.city || f.airport}</td>
                                        <td className="px-3 py-2">{f.time}</td>
                                        <td className="px-3 py-2">{f.gate}</td>
                                        <td className="px-3 py-2">{f.status}</td>
                                        <td className="px-3 py-2">
                                            <Link
                                                to={`/flights/${f.flight_id || f.id}`}
                                                className="underline"
                                            >
                                                Details
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {!data.items.length && (
                                    <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No flights.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(page - 1)}
                            className="rounded border px-3 py-1 disabled:opacity-50"
                        >
                            Prev
                        </button>
                        <span className="text-sm">Page {data.page}</span>
                        <button
                            disabled={page * data.pageSize >= data.total}
                            onClick={() => setPage(page + 1)}
                            className="rounded border px-3 py-1 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
