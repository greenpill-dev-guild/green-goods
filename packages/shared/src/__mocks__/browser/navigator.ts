/**
 * Comprehensive navigator polyfills for Vitest environment.
 * Ensures clipboard, serviceWorker, and other browser-only APIs exist during tests.
 */

const noopAsync = async () => void 0;
const noop = () => undefined;

// Store original navigator
const originalNavigator = global.navigator;

// Setup clipboard API
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

// Setup languages
if (!("languages" in navigator)) {
  Object.defineProperty(navigator, "languages", {
    configurable: true,
    enumerable: true,
    value: ["en-US"],
  });
}

// Setup permissions API
if (!("permissions" in navigator)) {
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    enumerable: true,
    value: {
      query: noopAsync,
    },
  });
}

// Setup serviceWorker API
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

// Setup onLine status
if (!("onLine" in navigator)) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    enumerable: true,
    value: true,
    writable: true,
  });
}

// Setup geolocation API
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

// Setup storage API
if (!("storage" in navigator)) {
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    enumerable: true,
    value: {
      estimate: () =>
        Promise.resolve({
          quota: 1024 * 1024 * 100, // 100MB
          usage: 1024 * 1024 * 20, // 20MB
        }),
      persist: () => Promise.resolve(true),
      persisted: () => Promise.resolve(true),
    },
  });
}

// Helper functions for tests
export const mockOnlineStatus = (isOnline: boolean) => {
  Object.defineProperty(global.navigator, "onLine", {
    value: isOnline,
    writable: true,
    configurable: true,
  });
};

export const mockStorageEstimate = (quota: number, usage: number) => {
  if (global.navigator.storage) {
    global.navigator.storage.estimate = () => Promise.resolve({ quota, usage });
  }
};

export const resetNavigatorMocks = () => {
  Object.defineProperty(global, "navigator", {
    value: originalNavigator,
    writable: true,
  });
};
