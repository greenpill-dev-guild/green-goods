import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { FabConfig } from "./NavigationBar";

// ----------------------------------------------------------------------------
// Context — Views declare FAB config, CanvasLayout consumes it
// ----------------------------------------------------------------------------

interface FabContextValue {
  config: FabConfig | null;
  setConfig: (config: FabConfig | null) => void;
}

const FabContext = createContext<FabContextValue>({
  config: null,
  setConfig: () => {},
});

// ----------------------------------------------------------------------------
// Provider — wraps the Canvas children in CanvasLayout
// ----------------------------------------------------------------------------

export function FabProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<FabConfig | null>(null);

  const value = useMemo(() => ({ config, setConfig }), [config]);

  return <FabContext.Provider value={value}>{children}</FabContext.Provider>;
}

// ----------------------------------------------------------------------------
// useFabConfig — called by views to declare their FAB actions
// ----------------------------------------------------------------------------

/**
 * Declare a FAB configuration for the current view.
 * The config is automatically cleared when the component unmounts.
 *
 * Pass `null` to explicitly hide the FAB (e.g., on a tab with no actions).
 *
 * @example
 * ```tsx
 * useFabConfig({
 *   icon: RiAddLine,
 *   label: "Create",
 *   actions: [{ id: "submit-work", icon: RiFileAddLine, label: "Submit Work", labelId: "hub.fab.submitWork" }],
 *   onAction: (id) => { if (id === "submit-work") openLeftSheet(); },
 * });
 * ```
 */
export function useFabConfig(config: FabConfig | null) {
  const { setConfig } = useContext(FabContext);
  const configRef = useRef(config);
  configRef.current = config;

  // Set on mount / update, clear on unmount
  useEffect(() => {
    setConfig(configRef.current);
    return () => setConfig(null);
  }, [setConfig]);

  // Update when config identity changes (new object reference)
  const update = useCallback(
    (newConfig: FabConfig | null) => {
      configRef.current = newConfig;
      setConfig(newConfig);
    },
    [setConfig]
  );

  // Sync config changes after initial mount
  useEffect(() => {
    setConfig(config);
  }, [config, setConfig]);

  return { update };
}

// ----------------------------------------------------------------------------
// useFabConfigValue — read-only consumer (CanvasLayout)
// ----------------------------------------------------------------------------

export function useFabConfigValue(): FabConfig | null {
  return useContext(FabContext).config;
}
