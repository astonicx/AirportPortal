import { Link } from "react-router-dom";

const COLUMNS = [
    { key: "flightNumber", label: "Flight" },
    { key: "airline", label: "Airline" },
    { key: "from", label: "From", sortable: false },
    { key: "to", label: "To", sortable: false },
    { key: "time", label: "Time" },
    { key: "gate", label: "Gate" },
    { key: "status", label: "Status", sortable: false },
];

// Desktop / tablet table view with clickable, sortable column headers.
export default function FlightTable({ items, sortBy, sortDir, onSort }) {
    const indicator = (key) =>
        sortBy === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

    return (
        <div className="hidden overflow-x-auto rounded border md:block">
            <table className="w-full text-sm">
                <thead className="bg-secondary">
                    <tr>
                        {COLUMNS.map((c) => (
                            <th key={c.key} className="px-3 py-2 text-left">
                                {c.sortable === false ? (
                                    c.label
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => onSort(c.key)}
                                        className="font-medium underline-offset-2 hover:underline"
                                        aria-label={`Sort by ${c.label}`}
                                    >
                                        {c.label}
                                        {indicator(c.key)}
                                    </button>
                                )}
                            </th>
                        ))}
                        <th className="px-3 py-2 text-left">Bookable</th>
                        <th className="px-3 py-2"></th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((f) => (
                        <tr key={f.flight_id || f.id} className="border-t">
                            <td className="px-3 py-2">{f.flightNumber}</td>
                            <td className="px-3 py-2">{f.airline}</td>
                            <td className="px-3 py-2">{f.from || "\u2014"}</td>
                            <td className="px-3 py-2">{f.to || "\u2014"}</td>
                            <td className="px-3 py-2">{f.time}</td>
                            <td className="px-3 py-2">{f.gate || "\u2014"}</td>
                            <td className="px-3 py-2">{f.status}</td>
                            <td className="px-3 py-2">
                                {f.canBook ? (
                                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                        Bookable
                                    </span>
                                ) : (
                                    <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                        Not bookable
                                    </span>
                                )}
                            </td>
                            <td className="px-3 py-2">
                                <Link to={`/flights/${f.flight_id || f.id}`} className="underline">
                                    Details
                                </Link>
                            </td>
                        </tr>
                    ))}
                    {!items.length && (
                        <tr>
                            <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                                No flights.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
