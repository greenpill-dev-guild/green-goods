import { useRouteError } from "react-router-dom";
import { ErrorRecovery, type RecoveryView } from "./ErrorRecovery";

/**
 * A route's `errorElement`. React Router catches a failed loader, a failed `lazy` import and a
 * route's render error before any React boundary sees them, and without an `errorElement` it
 * shows its own "Unexpected Application Error!" page and reports nothing.
 *
 * It replaces only the route it is set on, so the layout routes above it stay on screen. Pages
 * and screens sit inside a route that exists to carry it (`errorFrame` in config/routes.tsx):
 * public pages fail as `page` and keep the site's header, app screens as `screen` and keep the
 * bottom bar. The root takes `frame`, for a failure in the frame itself.
 */
export function RouteErrorBoundary({ view }: { view: RecoveryView }) {
  return <ErrorRecovery error={useRouteError()} view={view} boundary="RouteErrorBoundary" />;
}
