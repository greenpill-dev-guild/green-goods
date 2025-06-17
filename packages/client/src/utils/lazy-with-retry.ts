import { ComponentType, lazy } from "react";

interface LazyImportOptions {
  maxRetries?: number;
  delay?: number;
}

export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  options: LazyImportOptions = {}
): React.LazyExoticComponent<T> {
  const { maxRetries = 3, delay = 1000 } = options;

  return lazy(async () => {
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        return await componentImport();
      } catch (error) {
        attempts++;

        if (attempts >= maxRetries) {
          throw error;
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay * attempts));
      }
    }

    throw new Error("Failed to load component after maximum retries");
  });
}

// Preload utility for critical routes
export function preloadComponent(componentImport: () => Promise<any>) {
  const componentPromise = componentImport();

  return () => componentPromise;
}
