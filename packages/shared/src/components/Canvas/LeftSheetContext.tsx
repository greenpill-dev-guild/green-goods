import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface LeftSheetConfig {
  /** Sheet title displayed in the header */
  title: string;
  /** Sheet content (React element) */
  content: ReactNode;
  /** Called when the sheet is closed (e.g., navigate back) */
  onClose: () => void;
}

// ----------------------------------------------------------------------------
// Context — Views declare left sheet config, CanvasLayout consumes it
// ----------------------------------------------------------------------------

interface LeftSheetContextValue {
  config: LeftSheetConfig | null;
  setConfig: (config: LeftSheetConfig | null) => void;
}

const LeftSheetContext = createContext<LeftSheetContextValue>({
  config: null,
  setConfig: () => {},
});

// ----------------------------------------------------------------------------
// Provider — wraps the Canvas children in CanvasLayout
// ----------------------------------------------------------------------------

export function LeftSheetProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<LeftSheetConfig | null>(null);

  const value = useMemo(() => ({ config, setConfig }), [config]);

  return <LeftSheetContext.Provider value={value}>{children}</LeftSheetContext.Provider>;
}

// ----------------------------------------------------------------------------
// useLeftSheetConfig — called by views to declare their left sheet content
// ----------------------------------------------------------------------------

/**
 * Declare a left sheet configuration for the current view.
 * The config is automatically cleared when the component unmounts.
 *
 * Pass `null` to explicitly close the sheet.
 *
 * @example
 * ```tsx
 * useLeftSheetConfig(
 *   selectedWork
 *     ? { title: "Review Work", content: <WorkDetail />, onClose: handleClose }
 *     : null
 * );
 * ```
 */
export function useLeftSheetConfig(config: LeftSheetConfig | null) {
  const { setConfig } = useContext(LeftSheetContext);

  useEffect(() => {
    setConfig(config);
  }, [config, setConfig]);

  useEffect(() => {
    return () => setConfig(null);
  }, [setConfig]);
}

// ----------------------------------------------------------------------------
// useLeftSheetConfigValue — read-only consumer (CanvasLayout)
// ----------------------------------------------------------------------------

export function useLeftSheetConfigValue(): LeftSheetConfig | null {
  return useContext(LeftSheetContext).config;
}
