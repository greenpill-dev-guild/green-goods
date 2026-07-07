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
 *   onAction: (id) => { if (id === "submit-work") openSubmitWorkDialog(); },
 * });
 * ```
 */
export function useFabConfig(config: FabConfig | null) {
  const { setConfig } = useContext(FabContext);
  const configRef = useRef(config);
  configRef.current = config;
  const stableOnAction = useCallback((actionId: string) => {
    configRef.current?.onAction(actionId);
  }, []);
  const configSignature = config
    ? [
        "present",
        config.label,
        config.icon.displayName ?? config.icon.name ?? "icon",
        config.actions
          .map((action) =>
            [
              action.id,
              action.label,
              action.labelId,
              action.disabled ? "disabled" : "enabled",
              action.icon.displayName ?? action.icon.name ?? "icon",
            ].join("\u0001")
          )
          .join("\u0002"),
      ].join("\u0003")
    : "none";

  // Clear on unmount so the next route never inherits stale actions.
  useEffect(() => {
    return () => setConfig(null);
  }, [setConfig]);

  // Update when config identity changes (new object reference)
  const update = useCallback(
    (newConfig: FabConfig | null) => {
      configRef.current = newConfig;
      setConfig(
        newConfig
          ? {
              ...newConfig,
              actions: newConfig.actions.map((action) => ({ ...action })),
              onAction: stableOnAction,
            }
          : null
      );
    },
    [setConfig, stableOnAction]
  );

  // Sync only when the rendered FAB shape changes. The action callback itself
  // is read from configRef so unstable closures do not churn provider state.
  useEffect(() => {
    const currentConfig = configRef.current;
    if (!currentConfig) {
      setConfig(null);
      return;
    }

    setConfig({
      ...currentConfig,
      actions: currentConfig.actions.map((action) => ({ ...action })),
      onAction: stableOnAction,
    });
  }, [configSignature, setConfig, stableOnAction]);

  return { update };
}

// ----------------------------------------------------------------------------
// useFabConfigValue — read-only consumer (CanvasLayout)
// ----------------------------------------------------------------------------

export function useFabConfigValue(): FabConfig | null {
  return useContext(FabContext).config;
}
