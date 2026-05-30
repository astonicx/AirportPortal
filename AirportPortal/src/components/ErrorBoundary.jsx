import React from "react";

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        console.error("[ErrorBoundary]", error, info);
    }
    render() {
        if (this.state.error) {
            return (
                <div role="alert" className="m-6 rounded border border-destructive p-4">
                    <h2 className="font-semibold">Something went wrong.</h2>
                    <p className="text-sm text-muted-foreground">
                        {this.state.error.message}
                    </p>
                </div>
            );
        }
        return this.props.children;
    }
}
