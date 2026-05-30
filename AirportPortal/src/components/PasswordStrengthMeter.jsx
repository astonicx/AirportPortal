export function strengthOf(pw) {
    const len = pw?.length || 0;
    if (len === 0) return { level: "empty", label: "—", pct: 0 };
    if (len <= 10) return { level: "weak", label: "Weak", pct: 25 };
    if (len < 18) return { level: "moderate", label: "Moderate", pct: 60 };
    return { level: "strong", label: "Strong", pct: 100 };
}

export default function PasswordStrengthMeter({ password = "" }) {
    const s = strengthOf(password);
    const color =
        s.level === "weak"
            ? "bg-destructive"
            : s.level === "moderate"
                ? "bg-milwaukeeGold"
                : s.level === "strong"
                    ? "bg-green-600"
                    : "bg-muted";
    return (
        <div className="space-y-1" aria-live="polite">
            <div className="h-2 w-full overflow-hidden rounded bg-muted">
                <div
                    className={`h-full ${color} transition-all`}
                    style={{ width: `${s.pct}%` }}
                />
            </div>
            <p className="text-xs text-muted-foreground">{s.label}</p>
        </div>
    );
}
