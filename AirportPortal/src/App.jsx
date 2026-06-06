import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import Layout from "@/components/layout/Layout";
import { RequireAuth, RequireAdmin } from "@/components/Guards";
import { BookingProvider } from "@/context/BookingContext";

import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Recover from "@/pages/Recover";
import Flights from "@/pages/Flights";
import FlightDetail from "@/pages/FlightDetail";
import TicketLookup from "@/pages/TicketLookup";
import Ticket from "@/pages/Ticket";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";
import CompleteProfile from "@/pages/CompleteProfile";

import BookingSearch from "@/pages/booking/Search";
import Passenger from "@/pages/booking/Passenger";
import SeatMap from "@/pages/booking/SeatMap";
import Bags from "@/pages/booking/Bags";
import Payment from "@/pages/booking/Payment";
import Review from "@/pages/booking/Review";

import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminCustomers from "@/pages/admin/AdminCustomers";
import AdminTickets from "@/pages/admin/AdminTickets";
import AdminAdmins from "@/pages/admin/AdminAdmins";

function BookingShell() {
    return (
        <BookingProvider>
            <Outlet />
        </BookingProvider>
    );
}

export default function App() {
    return (
        <ErrorBoundary>
            <Routes>
                <Route element={<Layout />}>
                    <Route index element={<Navigate to="/flights" replace />} />
                    <Route path="login" element={<Login />} />
                    <Route path="signup" element={<Signup />} />
                    <Route path="recover" element={<Recover />} />
                    <Route path="flights" element={<Flights />} />
                    <Route path="flights/:id" element={<FlightDetail />} />
                    <Route path="ticket-lookup" element={<TicketLookup />} />
                    <Route path="tickets/:code" element={<Ticket />} />

                    <Route element={<RequireAuth><BookingShell /></RequireAuth>}>
                        <Route path="book" element={<BookingSearch />} />
                        <Route path="book/:id/passenger" element={<Passenger />} />
                        <Route path="book/:id/seat" element={<SeatMap />} />
                        <Route path="book/:id/bags" element={<Bags />} />
                        <Route path="book/:id/payment" element={<Payment />} />
                        <Route path="book/:id/review" element={<Review />} />
                    </Route>

                    <Route
                        path="dashboard"
                        element={<RequireAuth><Dashboard /></RequireAuth>}
                    />
                    <Route
                        path="settings"
                        element={<RequireAuth><Settings /></RequireAuth>}
                    />
                    <Route
                        path="complete"
                        element={<RequireAuth><CompleteProfile /></RequireAuth>}
                    />

                    <Route
                        path="admin"
                        element={<RequireAdmin><AdminLayout /></RequireAdmin>}
                    >
                        <Route index element={<AdminDashboard />} />
                        <Route path="customers" element={<AdminCustomers />} />
                        <Route path="tickets" element={<AdminTickets />} />
                        <Route path="admins" element={<AdminAdmins />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/flights" replace />} />
                </Route>
            </Routes>
        </ErrorBoundary>
    );
}
