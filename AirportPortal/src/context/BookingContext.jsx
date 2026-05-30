import { createContext, useContext, useState } from "react";

const BookingCtx = createContext(null);

export function BookingProvider({ children }) {
    const [booking, setBooking] = useState({
        flightId: null,
        flight: null,
        passenger: null,
        payment: null,
        seat: null,
        carryOnCount: 0,
        checkedCount: 0,
    });
    const update = (patch) => setBooking((b) => ({ ...b, ...patch }));
    const reset = () =>
        setBooking({
            flightId: null,
            flight: null,
            passenger: null,
            payment: null,
            seat: null,
            carryOnCount: 0,
            checkedCount: 0,
        });
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
