import React, { Component, ErrorInfo, ReactNode } from "react";
import { isRouteErrorResponse, useRouteError, Outlet } from "react-router-dom";
import { RiErrorWarningLine, RiRefreshLine, RiHomeLine } from "@remixicon/react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// React Error Boundary Class Component
class ErrorBoundaryClass extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    
    // Report to error tracking service in production
    if (import.meta.env.PROD) {
      // Add your error reporting service here
      // e.g., Sentry, LogRocket, etc.
    }
  }

  private handleRefresh = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div 
          className="min-h-screen bg-gray-50 flex items-center justify-center px-4"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
            <div className="mb-4">
              <RiErrorWarningLine 
                className="w-16 h-16 text-red-500 mx-auto mb-4" 
                aria-hidden="true"
              />
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Something went wrong
              </h1>
              <p className="text-gray-600 mb-6">
                We're sorry, but something unexpected happened. Please try refreshing the page or return to the home page.
              </p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={this.handleRefresh}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                aria-label="Refresh the page"
              >
                <RiRefreshLine className="w-4 h-4 inline mr-2" aria-hidden="true" />
                Refresh Page
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                aria-label="Go to home page"
              >
                <RiHomeLine className="w-4 h-4 inline mr-2" aria-hidden="true" />
                Go Home
              </button>
            </div>
            
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Error Details (Development)
                </summary>
                <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto max-h-40">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children || <Outlet />;
  }
}

// React Router Error Component
export function RouterErrorBoundary() {
  const error = useRouteError();

  const getErrorMessage = () => {
    if (isRouteErrorResponse(error)) {
      switch (error.status) {
        case 404:
          return {
            title: "Page Not Found",
            message: "The page you're looking for doesn't exist or has been moved.",
            showHomeButton: true,
          };
        case 403:
          return {
            title: "Access Denied",
            message: "You don't have permission to access this page.",
            showHomeButton: true,
          };
        case 500:
          return {
            title: "Server Error",
            message: "Something went wrong on our end. Please try again later.",
            showRefreshButton: true,
          };
        default:
          return {
            title: "Something went wrong",
            message: error.statusText || "An unexpected error occurred.",
            showRefreshButton: true,
          };
      }
    }

    if (error instanceof Error) {
      return {
        title: "Application Error",
        message: import.meta.env.DEV ? error.message : "An unexpected error occurred.",
        showRefreshButton: true,
        error: import.meta.env.DEV ? error : undefined,
      };
    }

    return {
      title: "Unknown Error",
      message: "An unexpected error occurred.",
      showRefreshButton: true,
    };
  };

  const errorInfo = getErrorMessage();

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = "/";
  };

  return (
    <div 
      className="min-h-screen bg-gray-50 flex items-center justify-center px-4"
      role="alert"
      aria-live="assertive"
    >
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
        <div className="mb-4">
          <RiErrorWarningLine 
            className="w-16 h-16 text-red-500 mx-auto mb-4"
            aria-hidden="true"
          />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            {errorInfo.title}
          </h1>
          <p className="text-gray-600 mb-6">
            {errorInfo.message}
          </p>
        </div>
        
        <div className="space-y-3">
          {errorInfo.showRefreshButton && (
            <button
              onClick={handleRefresh}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              aria-label="Refresh the page"
            >
              <RiRefreshLine className="w-4 h-4 inline mr-2" aria-hidden="true" />
              Refresh Page
            </button>
          )}
          
          {errorInfo.showHomeButton && (
            <button
              onClick={handleGoHome}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              aria-label="Go to home page"
            >
              <RiHomeLine className="w-4 h-4 inline mr-2" aria-hidden="true" />
              Go Home
            </button>
          )}
        </div>
        
        {import.meta.env.DEV && errorInfo.error && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              Error Details (Development)
            </summary>
            <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto max-h-40">
              {errorInfo.error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

// Main ErrorBoundary component that combines both approaches
export const ErrorBoundary: React.FC<Props> = ({ children }) => {
  return (
    <ErrorBoundaryClass>
      {children || <Outlet />}
    </ErrorBoundaryClass>
  );
};

export default ErrorBoundary;