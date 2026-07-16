import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLiveResource } from "@/hooks/useLiveResource";
import FlightTable from "@/components/FlightTable";
import FlightCard from "@/components/FlightCard";
import Spinner from "@/components/Spinner";

export default function Flights() {
    const [type, setType] = useState("departure");
    const [page, setPage] = useState(1);
    const [q, setQ] = useState("");
    const [debouncedQ, setDebouncedQ] = useState("");
    const [sortBy, setSortBy] = useState("time");
    const [sortDir, setSortDir] = useState("asc");

    // Debounce the free-text search so we don't refetch on every keystroke.
    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedQ(q);
            setPage(1);
        }, 350);
        return () => clearTimeout(t);
    }, [q]);

    const path = `/api/flights?type=${type}&page=${page}&pageSize=20&q=${encodeURIComponent(debouncedQ)}&sortBy=${sortBy}&sortDir=${sortDir}`;
    const { data, error, loading } = useLiveResource(path, { intervalMs: 60_000 });

    const onSort = (key) => {
        if (sortBy === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortBy(key);
            setSortDir("asc");
        }
        setPage(1);
    };

    return (
        <div className="animate-in-up space-y-5">
            <div className="space-y-1">
                <h1>Flights</h1>
                <p className="text-sm text-muted-foreground">
                    Live departures and arrivals, updated automatically.
                </p>
            </div>
            <div className="surface-card flex flex-wrap items-center gap-3 p-3">
                <Tabs
                    value={type}
                    onValueChange={(v) => { setType(v); setPage(1); }}
                >
                    <TabsList>
                        <TabsTrigger value="departure">Departures</TabsTrigger>
                        <TabsTrigger value="arrival">Arrivals</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="relative ml-auto w-full sm:w-72">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        🔍
                    </span>
                    <input
                        type="search"
                        placeholder="Search flight, airline, gate…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm shadow-sm transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        aria-label="Search flights"
                    />
                </div>
            </div>

            {loading && <Spinner />}
            {error && <p className="text-destructive">{error.message}</p>}

            {data && (
                <>
                    {/* Desktop / tablet table with clickable sortable headers */}
                    <div className="surface-card overflow-hidden">
                        <FlightTable
                            items={data.items}
                            sortBy={sortBy}
                            sortDir={sortDir}
                            onSort={onSort}
                        />
                    </div>

                    {/* Mobile cards */}
                    <div className="grid grid-cols-1 gap-3 md:hidden">
                        {data.items.map((f) => (
                            <FlightCard key={f.flight_id || f.id} flight={f} />
                        ))}
                        {!data.items.length && (
                            <p className="text-center text-muted-foreground">No flights.</p>
                        )}
                    </div>

                    <div className="flex items-center justify-center gap-3">
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(page - 1)}
                            className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
                        >
                            ← Prev
                        </button>
                        <span className="text-sm text-muted-foreground">Page {data.page}</span>
                        <button
                            disabled={page * data.pageSize >= data.total}
                            onClick={() => setPage(page + 1)}
                            className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
                        >
                            Next →
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
