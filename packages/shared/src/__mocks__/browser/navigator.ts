// Mock navigator APIs for testing

// Store original navigator
const originalNavigator = global.navigator;

// Mock navigator with default values
Object.defineProperty(global, "navigator", {
  value: {
    ...originalNavigator,
    onLine: true,
    storage: {
      estimate: () =>
        Promise.resolve({
          quota: 1024 * 1024 * 100, // 100MB
          usage: 1024 * 1024 * 20, // 20MB
        }),
    },
  },
  writable: true,
});

export const mockOnlineStatus = (isOnline: boolean) => {
  Object.defineProperty(global.navigator, "onLine", {
    value: isOnline,
    writable: true,
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
