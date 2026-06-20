import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import Spinner from "@/components/Spinner";

export default function BookingSearch() {
    const navigate = useNavigate();
    const [origin, setOrigin] = useState("");
    const [date, setDate] = useState("");
    const [results, setResults] = useState(null);
    const [homeAirport, setHomeAirport] = useState(null);
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);

    const runSearch = async (dest = "", dt = "") => {
        setErr(null);
        setBusy(true);
        try {
            const qs = new URLSearchParams({ origin: dest, date: dt }).toString();
            const r = await api.get(`/api/flights/search?${qs}`);
            setResults(r.items);
        } catch (e) {
            setErr(e);
        } finally {
            setBusy(false);
        }
    };

    // Show all currently bookable flights departing our airport on load.
    useEffect(() => {
        runSearch();
    }, []);

    // Resolve which airport guests are booking flights into.
    useEffect(() => {
        let cancelled = false;
        api
            .get("/api/flights/home-airport")
            .then((r) => !cancelled && setHomeAirport(r.airport))
            .catch(() => { });
        return () => { cancelled = true; };
    }, []);

    const search = async (e) => {
        e.preventDefault();
        await runSearch(origin, date);
    };

    return (
        <div className="mx-auto max-w-2xl space-y-4">
            <h1 className="text-xl font-bold">Book a flight</h1>
            <p className="text-sm text-muted-foreground">
                You can only book flights departing from{" "}
                <span className="font-semibold text-foreground">
                    {homeAirport ? `${homeAirport} (our airport)` : "our airport"}
                </span>
                . Browse all bookable departures below, or filter by destination and
                departure date.
            </p>
            <form onSubmit={search} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block text-sm sm:col-span-2">
                    Destination (city, state, country, or airport)
                    <input
                        type="text"
                        value={origin}
                        onChange={(e) => setOrigin(e.target.value)}
                        placeholder="e.g. Cleveland (optional)"
                        className="mt-1 w-full rounded border px-3 py-2"
                    />
                </label>
                <label className="block text-sm">
                    Date
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="mt-1 w-full rounded border px-3 py-2"
                    />
                </label>
                <button
                    disabled={busy}
                    className="rounded bg-milwaukeeBlue px-4 py-2 text-white disabled:opacity-50 sm:col-span-3"
                >
                    {busy ? "Searching…" : "Search flights"}
                </button>
            </form>

            {err && <p className="text-destructive">{err.data?.error || err.message}</p>}
            {busy && <Spinner />}

            {results && (
                <div className="overflow-x-auto rounded border">
                    <table className="w-full text-sm">
                        <thead className="bg-secondary">
                            <tr>
                                <th className="px-3 py-2 text-left">Flight</th>
                                <th className="px-3 py-2 text-left">Airline</th>
                                <th className="px-3 py-2 text-left">From</th>
                                <th className="px-3 py-2 text-left">To</th>
                                <th className="px-3 py-2 text-left">Departs</th>
                                <th className="px-3 py-2 text-left">Price</th>
                                <th className="px-3 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((f) => (
                                <tr key={f.flight_id} className="border-t">
                                    <td className="px-3 py-2">{f.flightNumber}</td>
                                    <td className="px-3 py-2">{f.airline}</td>
                                    <td className="px-3 py-2 font-medium">{f.from || homeAirport || "\u2014"}</td>
                                    <td className="px-3 py-2">{f.to || f.destination || "\u2014"}</td>
                                    <td className="px-3 py-2">{f.departTime || f.departFromReceiver}</td>
                                    <td className="px-3 py-2">${Number(f.seatPrice).toFixed(2)}</td>
                                    <td className="px-3 py-2">
                                        <button
                                            onClick={() => navigate(`/book/${f.flight_id}/passenger`)}
                                            className="rounded bg-milwaukeeBlue px-3 py-1 text-white"
                                        >
                                            Select
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!results.length && (
                                <tr>
                                    <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                                        No bookable flights match your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
