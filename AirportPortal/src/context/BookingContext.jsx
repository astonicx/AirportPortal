import { createContext, useContext, useEffect, useState } from "react";

const BookingCtx = createContext(null);

const STORAGE_KEY = "booking:v1";

const EMPTY = {
    flightId: null,
    flight: null,
    passenger: null,
    payment: null,
    seat: null,
    seatClass: null,
    extras: [],
    ffmToApply: 0,
    carryOnCount: 0,
    checkedCount: 0,
    baggagePricing: null,
};

function loadInitial() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) return { ...EMPTY, ...JSON.parse(raw) };
    } catch {
        /* ignore storage/parse errors */
    }
    return EMPTY;
}

export function BookingProvider({ children }) {
    const [booking, setBooking] = useState(loadInitial);

    // Persist across remounts and page refreshes so an in-progress booking is
    // never lost mid-flow ("Missing booking details").
    useEffect(() => {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(booking));
        } catch {
            /* ignore storage errors */
        }
    }, [booking]);

    const update = (patch) => setBooking((b) => ({ ...b, ...patch }));
    const reset = () => {
        setBooking(EMPTY);
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch {
            /* ignore storage errors */
        }
    };
    return (
        <BookingCtx.Provider value={{ booking, update, reset }}>
            {children}
        </BookingCtx.Provider>
    );
}

export function useBooking() {
    const ctx = useContext(BookingCtx);
    if (!ctx) throw new Error("useBooking must be used within BookingProvider");
    return ctx;
}
