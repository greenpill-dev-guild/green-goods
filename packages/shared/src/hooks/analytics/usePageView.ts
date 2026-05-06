/**
 * SPA Pageview Hook
 *
 * Tracks pageviews when the route changes in a single-page app.
 * Uses React Router's useLocation to detect navigation.
 *
 * Usage:
 * ```tsx
 * // In your app root (inside Router)
 * function App() {
 *   usePageView({ app: 'client' });
 *   return <Routes />;
 * }
 * ```
 */

import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { track } from "../../modules/app/posthog";

export interface UsePageViewOptions {
  /** App identifier for segmentation */
  app: "client" | "admin";
  /** Whether to track the initial pageview (default: true) */
  trackInitial?: boolean;
  /** Paths to exclude from tracking (e.g., ['/health', '/api']) */
  excludePaths?: string[];
}

/**
 * Track pageviews on route changes.
 *
 * This hook listens to React Router location changes and fires
 * a `page_view` event for each navigation.
 */
export function usePageView(options: UsePageViewOptions) {
  const { app, trackInitial = true, excludePaths = [] } = options;
  const location = useLocation();

  // Track if we've fired the initial pageview
  const isInitialRef = useRef(true);
  // Track previous path to avoid duplicate events
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const { pathname, search, hash } = location;

    // Skip excluded paths
    if (excludePaths.some((excluded) => pathname.startsWith(excluded))) {
      return;
    }

    // Skip if path hasn't changed (can happen with search/hash only changes)
    if (prevPathRef.current === pathname) {
      return;
    }

    // Skip initial if not wanted
    if (isInitialRef.current && !trackInitial) {
      isInitialRef.current = false;
      prevPathRef.current = pathname;
      return;
    }

    // Track the pageview
    track("page_view", {
      app,
      path: pathname,
      // Sanitize search params (remove sensitive data)
      search: sanitizeSearch(search),
      hash: sanitizeHash(hash),
      // Include referrer for initial pageview
      referrer: isInitialRef.current ? document.referrer || undefined : undefined,
      is_initial: isInitialRef.current,
    });

    // Update refs
    isInitialRef.current = false;
    prevPathRef.current = pathname;
  }, [location, app, trackInitial, excludePaths]);
}

function sanitizeHash(hash: string): string | undefined {
  if (!hash) return undefined;
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.includes("=")) return hash;

  const sensitiveParams = getSensitiveParams();

  try {
    const params = new URLSearchParams(raw);
    const sanitized = new URLSearchParams();

    params.forEach((value, key) => {
      if (sensitiveParams.has(key.toLowerCase())) {
        sanitized.set(key, "[REDACTED]");
      } else {
        sanitized.set(key, value);
      }
    });

    const result = sanitized.toString();
    return result ? `#${result}` : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Sanitize search params to remove potentially sensitive data.
 * Keeps param names but redacts values for known sensitive params.
 */
function sanitizeSearch(search: string): string | undefined {
  if (!search) return undefined;

  const SENSITIVE_PARAMS = getSensitiveParams();

  try {
    const params = new URLSearchParams(search);
    const sanitized = new URLSearchParams();

    params.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_PARAMS.has(lowerKey)) {
        sanitized.set(key, "[REDACTED]");
      } else {
        sanitized.set(key, value);
      }
    });

    const result = sanitized.toString();
    return result ? `?${result}` : undefined;
  } catch {
    // If parsing fails, don't include search
    return undefined;
  }
}

function getSensitiveParams(): Set<string> {
  return new Set([
    "token",
    "receipttoken",
    "key",
    "secret",
    "password",
    "code",
    "state",
    "nonce",
    "signature",
    "sig",
  ]);
}
