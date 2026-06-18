import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import type { LeftSheetWidth } from "./LeftSheet";

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
  /** Blocks shell-level close gestures while an in-sheet write is active. */
  preventClose?: boolean;
  /** Width hint for desktop side sheets. */
  width?: LeftSheetWidth;
}

export interface RouteBackedLeftSheetConfig {
  title: string;
  content: ReactNode;
  closeTo: string;
  onBeforeClose?: () => void;
  preventClose?: boolean;
  width?: LeftSheetWidth;
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

export function useRouteBackedLeftSheetConfig(config: RouteBackedLeftSheetConfig | null) {
  const navigate = useNavigate();

  const handleClose = useCallback(() => {
    if (!config) return;
    config.onBeforeClose?.();
    navigate(config.closeTo);
  }, [config, navigate]);

  const leftSheetConfig = useMemo<LeftSheetConfig | null>(
    () =>
      config
        ? {
            title: config.title,
            content: config.content,
            onClose: handleClose,
            preventClose: config.preventClose,
            width: config.width,
          }
        : null,
    [config, handleClose]
  );

  useLeftSheetConfig(leftSheetConfig);
}
