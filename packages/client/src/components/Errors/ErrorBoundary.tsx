import React, { Component, ReactNode } from "react";
import { IntlShape, useIntl } from "react-intl";
import { RiLeafFill, RiRefreshLine, RiArrowGoBackLine } from "@remixicon/react";
import { Button } from "../Actions";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  intl?: IntlShape;
}

class GardenErrorBoundaryClass extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Garden Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { intl } = this.props;

      return (
        <div className="flex flex-col items-center justify-center h-full p-8 bg-white">
          <div className="text-center max-w-md">
            <div className="mx-auto mb-4 w-14 h-14 rounded-2xl grid place-items-center bg-primary/10">
              <RiLeafFill className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-900">
              {intl?.formatMessage({
                id: "app.error.garden.title",
                defaultMessage: "Garden failed to load",
              })}
            </h2>
            <p className="text-gray-600 mb-6">
              {intl?.formatMessage({
                id: "app.error.garden.description",
                defaultMessage: "Something went wrong while loading this garden. Please try again.",
              })}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="primary"
                mode="filled"
                size="medium"
                label={
                  intl?.formatMessage({
                    id: "app.error.garden.reload",
                    defaultMessage: "Reload",
                  }) || "Reload"
                }
                leadingIcon={<RiRefreshLine className="w-5 h-5" />}
                onClick={() => window.location.reload()}
              />
              <Button
                variant="neutral"
                mode="stroke"
                size="medium"
                label={
                  intl?.formatMessage({
                    id: "app.error.garden.goBack",
                    defaultMessage: "Go Back",
                  }) || "Go Back"
                }
                leadingIcon={<RiArrowGoBackLine className="w-5 h-5" />}
                onClick={() => window.history.back()}
              />
            </div>
            {this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500">
                  {intl?.formatMessage({
                    id: "app.error.garden.technicalDetails",
                    defaultMessage: "Technical details",
                  })}
                </summary>
                <pre className="mt-2 text-xs bg-slate-50 border border-slate-200 p-3 rounded-lg overflow-auto max-h-40">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component to inject intl from hook
export const GardenErrorBoundary: React.FC<Omit<ErrorBoundaryProps, "intl">> = (props) => {
  const intl = useIntl();
  return <GardenErrorBoundaryClass {...props} intl={intl} />;
};
