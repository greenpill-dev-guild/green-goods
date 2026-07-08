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
import type { AdminDialogProps } from "@/components/AdminDialog";

// ----------------------------------------------------------------------------
// Left-inspector channel (admin-local)
//
// The admin left/bottom canvas sheets are retired; the workspace "inspector"
// flows (work detail, hypercert, action create/edit, vault, etc.) now render
// through the shared AdminDialog. Views still declare *what* to show and *how*
// to close from wherever they mount — this thin context carries that config up
// to CanvasLayout, which renders the single AdminDialog.
//
// This used to live in `@green-goods/shared` as `LeftSheetContext`, but it is
// admin-only (zero client consumers) and its config is now shaped as
// AdminDialog props, so it belongs next to the admin dialog it drives. The
// hook names are kept identical so descriptors don't have to change shape.
// ----------------------------------------------------------------------------

/** Dialog size/tone the descriptors emit — a subset of AdminDialog's props. */
type LeftSheetDialogSize = NonNullable<AdminDialogProps["size"]>;
type LeftSheetDialogTone = NonNullable<AdminDialogProps["tone"]>;

export interface LeftSheetConfig {
  /** Dialog title displayed in the header. */
  title: string;
  /** Dialog content (React element). */
  content: ReactNode;
  /** Called when the dialog is closed (e.g., navigate back). */
  onClose: () => void;
  /** Blocks shell-level close gestures while an in-dialog write is active. */
  preventClose?: boolean;
  /** AdminDialog size tier for this inspector. Defaults to `lg` at the shell. */
  size?: LeftSheetDialogSize;
  /**
   * Workspace tone for the portaled dialog. The dialog portals out of
   * CanvasLayout's `[data-tone]` scope, so descriptors pass their workspace
   * tone to keep the per-view accent (Hub blue, Garden green, etc.).
   */
  tone?: LeftSheetDialogTone;
}

// Internal to this channel — consumers pass inline literals to
// useRouteBackedLeftSheetConfig, so this shape is not re-exported.
interface RouteBackedLeftSheetConfig {
  title: string;
  content: ReactNode;
  closeTo: string;
  onBeforeClose?: () => void;
  preventClose?: boolean;
  size?: LeftSheetDialogSize;
  tone?: LeftSheetDialogTone;
}

// ----------------------------------------------------------------------------
// Context — views declare config, CanvasLayout consumes it
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
// useLeftSheetConfig — called by views to declare their inspector content
// ----------------------------------------------------------------------------

/**
 * Declare a left-inspector configuration for the current view.
 * The config is automatically cleared when the component unmounts.
 *
 * Pass `null` to explicitly close the inspector.
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
            size: config.size,
            tone: config.tone,
          }
        : null,
    [config, handleClose]
  );

  useLeftSheetConfig(leftSheetConfig);
}
