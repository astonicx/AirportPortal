import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export function useLiveResource(path, { intervalMs = 60_000, enabled = true } = {}) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const prevJson = useRef(null);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        let timer;

        async function tick() {
            try {
                const next = await api.get(path);
                if (cancelled) return;
                const json = JSON.stringify(next);
                if (prevJson.current && prevJson.current !== json) {
                    window.dispatchEvent(
                        new CustomEvent("toast", {
                            detail: { title: "Updated", description: path },
                        })
                    );
                }
                prevJson.current = json;
                setData(next);
                setError(null);
            } catch (e) {
                if (!cancelled) setError(e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        function schedule() {
            tick();
            timer = setInterval(() => {
                if (document.visibilityState === "visible") tick();
            }, intervalMs);
        }

        schedule();
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [path, intervalMs, enabled]);

    return { data, error, loading };
}
