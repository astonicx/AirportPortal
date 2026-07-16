import { Link } from "react-router-dom";

export default function NotFound() {
    return (
        <div className="mx-auto max-w-md py-16 text-center space-y-4">
            <h1 className="text-4xl font-bold">404</h1>
            <p className="text-muted-foreground">
                The page you’re looking for doesn’t exist or has been moved.
            </p>
            <div className="flex justify-center gap-4 text-sm">
                <Link to="/flights" className="underline">View flights</Link>
                <Link to="/" className="underline">Home</Link>
            </div>
        </div>
    );
}
