/**
 * Shared Package Test Setup
 *
 * Uses base setup since this is the shared package itself.
 * The base setup auto-initializes when imported.
 */

// Import base setup - it will auto-run setupTestEnvironment()
import "./setupTests.base";

interface HappyDOMFetchContext {
  request: { url: string };
  window: { Response: typeof Response };
}

// happy-dom serves `window.fetch` itself, over the real network, so a request the strict global
// fetch never sees (AppKit's telemetry beacon, for one) could leave the process and reject once its
// window closed, failing whichever file was running. Answer every such request here instead.
const happyDOM = (
  globalThis as {
    happyDOM?: { settings: { fetch: { interceptor: unknown } } };
  }
).happyDOM;
if (happyDOM) {
  happyDOM.settings.fetch.interceptor = {
    beforeAsyncRequest: async ({ request, window }: HappyDOMFetchContext) =>
      new window.Response(null, { status: 503, statusText: `No network in tests: ${request.url}` }),
  };
}
