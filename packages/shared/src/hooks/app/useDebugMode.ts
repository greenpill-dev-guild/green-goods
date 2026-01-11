/**
 * useDebugMode Hook
 *
 * Provides access to debug mode state and controls.
 * When debug mode is enabled:
 * - Error toasts show verbose information (error name, message, stack trace)
 * - A "Copy Error" button appears to copy full error details to clipboard
 * - Toast duration is increased to allow reading/copying
 *
 * Debug mode state is persisted to localStorage.
 *
 * @example
 * ```tsx
 * const { debugMode, toggleDebugMode, setDebugMode } = useDebugMode();
 *
 * // Toggle debug mode
 * <button onClick={toggleDebugMode}>
 *   Debug: {debugMode ? 'ON' : 'OFF'}
 * </button>
 * ```
 *
 * @module hooks/app/useDebugMode
 */

import { useUIStore } from "../../stores/useUIStore";

export interface DebugModeState {
  /** Whether debug mode is currently enabled */
  debugMode: boolean;
  /** Set debug mode on or off */
  setDebugMode: (enabled: boolean) => void;
  /** Toggle debug mode on/off */
  toggleDebugMode: () => void;
}

/**
 * Hook to access and control debug mode.
 */
export function useDebugMode(): DebugModeState {
  const debugMode = useUIStore((state) => state.debugMode);
  const setDebugMode = useUIStore((state) => state.setDebugMode);
  const toggleDebugMode = useUIStore((state) => state.toggleDebugMode);

  return {
    debugMode,
    setDebugMode,
    toggleDebugMode,
  };
}
