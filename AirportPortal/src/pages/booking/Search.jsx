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
        <div className="animate-in-up mx-auto max-w-3xl space-y-5">
            <div className="space-y-1">
                <p className="page-eyebrow">Booking</p>
                <h1>Book a flight</h1>
            </div>
            <p className="text-sm text-muted-foreground">
                You can only book flights departing from{" "}
                <span className="font-semibold text-foreground">
                    {homeAirport ? `${homeAirport} (our airport)` : "our airport"}
                </span>
                . Browse all bookable departures below, or filter by destination and
                departure date.
            </p>
            <form onSubmit={search} className="form-card grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="field-label sm:col-span-2">
                    Destination (city, state, country, or airport)
                    <input
                        type="text"
                        value={origin}
                        onChange={(e) => setOrigin(e.target.value)}
                        placeholder="e.g. Cleveland (optional)"
                        className="field-input"
                    />
                </label>
                <label className="field-label">
                    Date
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="field-input"
                    />
                </label>
                <button
                    disabled={busy}
                    className="btn-primary sm:col-span-3"
                >
                    {busy ? "Searching…" : "Search flights"}
                </button>
            </form>

            {err && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err.data?.error || err.message}</p>}
            {busy && <Spinner />}

            {results && (
                <div className="surface-card overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                                <th className="px-4 py-3 text-left font-semibold">Flight</th>
                                <th className="px-4 py-3 text-left font-semibold">Airline</th>
                                <th className="px-4 py-3 text-left font-semibold">From</th>
                                <th className="px-4 py-3 text-left font-semibold">To</th>
                                <th className="px-4 py-3 text-left font-semibold">Departs</th>
                                <th className="px-4 py-3 text-left font-semibold">Price</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((f) => (
                                <tr key={f.flight_id} className="border-b transition-colors even:bg-muted/30 hover:bg-primary/5">
                                    <td className="px-4 py-3 font-semibold">{f.flightNumber}</td>
                                    <td className="px-4 py-3">{f.airline}</td>
                                    <td className="px-4 py-3 font-medium">{f.from || homeAirport || "\u2014"}</td>
                                    <td className="px-4 py-3">{f.to || f.destination || "\u2014"}</td>
                                    <td className="px-4 py-3">{f.departTime || f.departFromReceiver}</td>
                                    <td className="px-4 py-3 font-semibold text-primary">${Number(f.seatPrice).toFixed(2)}</td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => navigate(`/book/${f.flight_id}/passenger`)}
                                            className="rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:shadow-md hover:brightness-110"
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
