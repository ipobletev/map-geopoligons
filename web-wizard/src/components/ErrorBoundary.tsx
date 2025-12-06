import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 bg-red-50 min-h-screen">
                    <h1 className="text-2xl font-bold text-red-800 mb-4">Something went wrong.</h1>
                    <div className="bg-white p-6 rounded-lg shadow-md border border-red-200 overflow-auto">
                        <h2 className="text-lg font-semibold text-red-700 mb-2">Error:</h2>
                        <pre className="text-sm text-red-600 mb-4 whitespace-pre-wrap">
                            {this.state.error && this.state.error.toString()}
                        </pre>
                        <h2 className="text-lg font-semibold text-gray-700 mb-2">Component Stack:</h2>
                        <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </pre>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
