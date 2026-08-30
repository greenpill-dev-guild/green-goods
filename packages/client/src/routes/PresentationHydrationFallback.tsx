/**
 * Static HTML owns startup for both presentation modes. Returning no React
 * fallback keeps the installed PWA on the exact same DOM surface until the
 * route and authentication boundary are ready.
 */
export function PresentationHydrationFallback() {
  return null;
}
