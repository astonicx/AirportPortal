import { useEffect, useState } from "react";

function rand(n) {
    return Math.floor(Math.random() * n);
}

export function makeChallenge() {
    const a = rand(9) + 1;
    const b = rand(9) + 1;
    return { question: `${a} + ${b}`, answer: String(a + b) };
}

export default function Captcha({ value, onChange, onChallengeChange }) {
    const [c, setC] = useState(() => makeChallenge());

    useEffect(() => {
        onChallengeChange?.(c.answer);
    }, [c, onChallengeChange]);

    const refresh = () => setC(makeChallenge());

    return (
        <div className="flex items-end gap-2">
            <div className="flex-1">
                <label className="block text-sm font-medium">
                    What is {c.question}?
                </label>
                <input
                    type="text"
                    inputMode="numeric"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2"
                    autoComplete="off"
                    required
                />
            </div>
            <button
                type="button"
                onClick={refresh}
                className="rounded border px-3 py-2 text-sm hover:bg-secondary"
            >
                ↻
            </button>
        </div>
    );
}
