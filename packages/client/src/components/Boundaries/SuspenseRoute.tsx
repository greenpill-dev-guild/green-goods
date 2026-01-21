import { type ReactNode, type ComponentType, type ErrorInfo, useCallback } from "react";
import { trackErrorBoundary } from "@green-goods/shared/modules";
import { SuspenseBoundary, RouteLoader } from "./SuspenseBoundary";

export interface SuspenseRouteProps {
  children: ReactNode;
  /**
   * Fallback UI to show while the route is loading
   * Defaults to RouteLoader
   */
  fallback?: ReactNode;
  /**
   * Loading message to display
   */
  loadingMessage?: string;
  /**
   * Name for error tracking and debugging
   */
  routeName?: string;
  /**
   * Custom error fallback component
   */
  errorFallback?: ComponentType<{
    error: Error | null;
    errorType: string;
    resetError: () => void;
  }>;
}

/**
 * SuspenseRoute - Wrapper for routes using Suspense-enabled queries
 *
 * Use this component to wrap route views that use useSuspenseQuery hooks.
 * It provides both loading states (via Suspense) and error handling (via ErrorBoundary).
 *
 * This is opt-in - only wrap routes that use suspense-enabled hooks.
 * Routes using traditional useQuery hooks don't need this wrapper.
 *
 * @example
 * // In router.tsx
 * {
 *   path: "home",
 *   element: (
 *     <SuspenseRoute routeName="home" loadingMessage="Loading gardens...">
 *       <HomeView />
 *     </SuspenseRoute>
 *   ),
 * }
 *
 * @example
 * // With custom skeleton
 * <SuspenseRoute
 *   fallback={<HomePageSkeleton />}
 *   routeName="home"
 * >
 *   <HomeView />
 * </SuspenseRoute>
 */
export function SuspenseRoute({
  children,
  fallback,
  loadingMessage = "Loading...",
  routeName,
  errorFallback,
}: SuspenseRouteProps) {
  const handleError = useCallback(
    (error: Error, errorInfo: ErrorInfo) => {
      trackErrorBoundary(error, {
        componentStack: errorInfo.componentStack,
        boundaryName: `SuspenseRoute:${routeName || "unknown"}`,
      });
    },
    [routeName]
  );

  const defaultFallback = <RouteLoader message={loadingMessage} />;

  return (
    <SuspenseBoundary
      fallback={fallback ?? defaultFallback}
      errorFallback={errorFallback}
      onError={handleError}
      boundaryId={routeName}
    >
      {children}
    </SuspenseBoundary>
  );
}

/**
 * withSuspense - HOC for wrapping components with Suspense boundary
 *
 * Use this to wrap individual components that use suspense-enabled hooks.
 *
 * @example
 * const SuspendedGardenList = withSuspense(GardenList, {
 *   fallback: <GardenCardSkeleton count={3} />,
 *   componentName: 'GardenList',
 * });
 */
export function withSuspense<P extends object>(
  Component: ComponentType<P>,
  options: {
    fallback?: ReactNode;
    componentName?: string;
    loadingMessage?: string;
  } = {}
): ComponentType<P> {
  const { fallback, componentName, loadingMessage = "Loading..." } = options;

  function SuspendedComponent(props: P) {
    return (
      <SuspenseBoundary
        fallback={fallback ?? <RouteLoader message={loadingMessage} />}
        boundaryId={componentName}
        onError={(error, errorInfo) => {
          trackErrorBoundary(error, {
            componentStack: errorInfo.componentStack,
            boundaryName: `withSuspense:${componentName || "unknown"}`,
          });
        }}
      >
        <Component {...props} />
      </SuspenseBoundary>
    );
  }

  SuspendedComponent.displayName = `withSuspense(${componentName || Component.displayName || Component.name || "Component"})`;

  return SuspendedComponent;
}
