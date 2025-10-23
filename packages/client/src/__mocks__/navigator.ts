/**
 * Lightweight navigator polyfills for Vitest environment.
 * Ensures clipboard and other browser-only APIs exist during tests.
 */

const noopAsync = async () => void 0;
const noop = () => undefined;

if (!("clipboard" in navigator)) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    enumerable: true,
    value: {
      writeText: noopAsync,
      readText: async () => "",
    },
  });
}

if (!("languages" in navigator)) {
  Object.defineProperty(navigator, "languages", {
    configurable: true,
    enumerable: true,
    value: ["en-US"],
  });
}

if (!("permissions" in navigator)) {
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    enumerable: true,
    value: {
      query: noopAsync,
    },
  });
}

if (!("serviceWorker" in navigator)) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    enumerable: true,
    value: {
      register: noopAsync,
      ready: Promise.resolve({
        pushManager: {
          subscribe: noopAsync,
        },
      }),
      getRegistrations: async () => [],
      getRegistration: async () => undefined,
      addEventListener: noop,
      removeEventListener: noop,
    },
  });
}

if (!("onLine" in navigator)) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    enumerable: true,
    value: true,
    writable: true,
  });
}

if (!("geolocation" in navigator)) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    enumerable: true,
    value: {
      getCurrentPosition: noop,
      watchPosition: noop,
      clearWatch: noop,
    },
  });
}
