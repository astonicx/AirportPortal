export default function Spinner({ label = "Loading…" }) {
    return (
        <div
            role="status"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>{label}</span>
        </div>
    );
}
