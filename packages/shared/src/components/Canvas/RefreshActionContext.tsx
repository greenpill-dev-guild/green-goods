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

export interface RefreshActionConfig {
  onRefresh: () => void;
  /** Whether the underlying data is currently refetching — drives the spinner. */
  isFetching?: boolean;
  /** Optional label override; defaults to "Refresh" / i18n in the consumer. */
  labelId?: string;
}

interface RefreshActionContextValue {
  config: RefreshActionConfig | null;
  setConfig: (config: RefreshActionConfig | null) => void;
}

const RefreshActionContext = createContext<RefreshActionContextValue>({
  config: null,
  setConfig: () => {},
});

/**
 * Wraps the admin canvas so a single view at a time can register a refresh
 * handler that bubbles up to the AppBar (mobile only). Sibling to FabProvider.
 */
export function RefreshActionProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<RefreshActionConfig | null>(null);
  const value = useMemo(() => ({ config, setConfig }), [config]);
  return <RefreshActionContext.Provider value={value}>{children}</RefreshActionContext.Provider>;
}

/**
 * Register the active view's refresh handler. Auto-clears on unmount and
 * on prop change so navigating between routes stops surfacing stale handlers.
 *
 * @example
 * ```tsx
 * useRefreshAction({ onRefresh: hub.handleRefresh, isFetching: hub.worksFetching });
 * ```
 */
export function useRefreshAction(config: RefreshActionConfig | null) {
  const { setConfig } = useContext(RefreshActionContext);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    setConfig(configRef.current);
    return () => setConfig(null);
  }, [setConfig]);

  // Sync prop changes after initial mount.
  useEffect(() => {
    setConfig(config);
  }, [config, setConfig]);

  return useCallback(
    (next: RefreshActionConfig | null) => {
      configRef.current = next;
      setConfig(next);
    },
    [setConfig]
  );
}

/** Read-only consumer (AppBar). */
export function useRefreshActionValue(): RefreshActionConfig | null {
  return useContext(RefreshActionContext).config;
}
