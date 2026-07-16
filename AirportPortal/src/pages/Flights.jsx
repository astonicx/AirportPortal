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
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">Flights</h1>
            <div className="flex flex-wrap items-center gap-3">
                <Tabs
                    value={type}
                    onValueChange={(v) => { setType(v); setPage(1); }}
                >
                    <TabsList>
                        <TabsTrigger value="departure">Departures</TabsTrigger>
                        <TabsTrigger value="arrival">Arrivals</TabsTrigger>
                    </TabsList>
                </Tabs>
                <input
                    type="search"
                    placeholder="Search flight, airline, gate…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="rounded border px-3 py-2"
                    aria-label="Search flights"
                />
            </div>

            {loading && <Spinner />}
            {error && <p className="text-destructive">{error.message}</p>}

            {data && (
                <>
                    {/* Desktop / tablet table with clickable sortable headers */}
                    <FlightTable
                        items={data.items}
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onSort={onSort}
                    />

                    {/* Mobile cards */}
                    <div className="grid grid-cols-1 gap-3 md:hidden">
                        {data.items.map((f) => (
                            <FlightCard key={f.flight_id || f.id} flight={f} />
                        ))}
                        {!data.items.length && (
                            <p className="text-center text-muted-foreground">No flights.</p>
                        )}
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
