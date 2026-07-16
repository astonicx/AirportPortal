import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import Layout from "@/components/layout/Layout";
import { RequireAuth, RequireAdmin, RequireAttendant } from "@/components/Guards";
import { BookingProvider } from "@/context/BookingContext";

import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Recover from "@/pages/Recover";
import VerifyEmail from "@/pages/VerifyEmail";
import Flights from "@/pages/Flights";
import FlightDetail from "@/pages/FlightDetail";
import TicketLookup from "@/pages/TicketLookup";
import Ticket from "@/pages/Ticket";
import Checkin from "@/pages/Checkin";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";
import CompleteProfile from "@/pages/CompleteProfile";
import NotFound from "@/pages/NotFound";

import BookingSearch from "@/pages/booking/Search";
import Passenger from "@/pages/booking/Passenger";
import SeatMap from "@/pages/booking/SeatMap";
import Bags from "@/pages/booking/Bags";
import Payment from "@/pages/booking/Payment";
import Review from "@/pages/booking/Review";

import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminCustomers from "@/pages/admin/AdminCustomers";
import AdminAttendants from "@/pages/admin/AdminAttendants";
import AdminTickets from "@/pages/admin/AdminTickets";
import AdminAdmins from "@/pages/admin/AdminAdmins";
import AttendantDashboard from "@/pages/admin/AttendantDashboard";

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
                    <Route path="verify-email" element={<VerifyEmail />} />
                    <Route path="flights" element={<Flights />} />
                    <Route path="flights/:id" element={<FlightDetail />} />
                    <Route path="ticket-lookup" element={<TicketLookup />} />
                    <Route path="checkin" element={<Checkin />} />
                    {/* Spec route name */}
                    <Route path="ticket/:code" element={<Ticket />} />
                    {/* Backwards-compatible alias */}
                    <Route path="tickets/:code" element={<Ticket />} />

                    <Route element={<BookingShell />}>
                        <Route path="book" element={<BookingSearch />} />
                        <Route path="book/:id" element={<Navigate to="passenger" replace />} />
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
                    {/* Spec route name */}
                    <Route
                        path="dashboard/settings"
                        element={<RequireAuth><Settings /></RequireAuth>}
                    />
                    {/* Backwards-compatible alias */}
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
                        <Route path="attendants" element={<AdminAttendants />} />
                        <Route path="tickets" element={<AdminTickets />} />
                        <Route path="admins" element={<AdminAdmins />} />
                    </Route>

                    <Route
                        path="attendant"
                        element={<RequireAttendant><AttendantDashboard /></RequireAttendant>}
                    />

                    <Route path="*" element={<NotFound />} />
                </Route>
            </Routes>
        </ErrorBoundary>
    );
}
