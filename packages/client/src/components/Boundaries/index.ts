/**
 * Boundary Components
 *
 * Components for handling error and suspense boundaries in the app.
 * These provide consistent loading and error states across routes.
 */

export { SuspenseRoute, withSuspense, type SuspenseRouteProps } from "./SuspenseRoute";
export {
  SuspenseBoundary,
  DefaultSuspenseFallback,
  DefaultErrorFallback,
  RouteLoader,
  type SuspenseBoundaryProps,
} from "./SuspenseBoundary";
