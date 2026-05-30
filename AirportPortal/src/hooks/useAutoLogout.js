import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export function useAutoLogout(minutes, onLogout) {
    const navigate = useNavigate();
    const timer = useRef(null);

    useEffect(() => {
        if (!minutes || minutes <= 0) return;
        const ms = minutes * 60_000;
        const reset = () => {
            clearTimeout(timer.current);
            timer.current = setTimeout(async () => {
                if (onLogout) await onLogout();
                navigate("/login");
            }, ms);
        };
        const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
        events.forEach((e) => window.addEventListener(e, reset));
        reset();
        return () => {
            clearTimeout(timer.current);
            events.forEach((e) => window.removeEventListener(e, reset));
        };
    }, [minutes, onLogout, navigate]);
}
