/**
 * Utilities for persisting form state in sessionStorage
 * Used by multi-step creation forms to preserve progress within a browser session
 */

import { logger } from "../../modules/app/logger";

export function saveFormDraft<T>(key: string, data: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    logger.warn("Failed to save form draft", { error });
  }
}

export function loadFormDraft<T>(key: string): T | null {
  try {
    const item = sessionStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    logger.warn("Failed to load form draft", { error });
    return null;
  }
}

export function clearFormDraft(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    logger.warn("Failed to clear form draft", { error });
  }
}
