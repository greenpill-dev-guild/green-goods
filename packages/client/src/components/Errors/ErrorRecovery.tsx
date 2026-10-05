import { useEventListener } from "@green-goods/shared/hooks/utils/useEventListener";
import { trackErrorBoundary } from "@green-goods/shared/modules/app/error-events";
import { logger } from "@green-goods/shared/modules/app/logger";
import {
  type ComponentType,
  createContext,
  type RefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { isRouteErrorResponse } from "react-router-dom";
import {
  classifyErrorMessage,
  type ErrorCategory,
  hasChunkReloadAttempt,
  isChunkLoadErrorMessage,
  markChunkReloadAttempt,
} from "./errorClassification";

/**
 * Where the failure is shown, which decides what it looks like:
 *
 * - `page`: a public page, inside the site's header and footer.
 * - `ceremony`: a reporting ceremony page, inside its focused bar. It is drawn as the app draws.
 * - `screen`: one screen of the installed app, inside its shell and over its bottom bar.
 * - `frame`: the frame itself failed, so nothing around the failure can be trusted: the website
 *   as one card, the installed app as its could-not-open screen.
 */
export type RecoveryView = "page" | "ceremony" | "screen" | "frame";

/** What a recovery screen inside a working frame is given. */
export interface RecoveryScreenProps {
  /** The code could not be fetched without a connection; the screen reloads on reconnect. */
  offline: boolean;
  onReload: () => void;
}

/** A frame's own screen also covers the moment the app reloads itself onto a new build. */
export interface RecoveryFrameProps {
  offline?: boolean;
  updating?: boolean;
  onReload?: () => void;
}

/**
 * The screens one presentation recovers with. The website and the installed app each hand over
 * their own (`PublicRecoveryViews`, `AppRecoveryViews`), so neither loads the other's: the
 * website's start must not carry the app's sign-in scaffold, nor the app the site's hero.
 */
export interface RecoveryViews {
  /** Renders without a router or the app's providers, because either may be what failed. */
  frame: ComponentType<RecoveryFrameProps>;
  page?: ComponentType<RecoveryScreenProps>;
  ceremony?: ComponentType<RecoveryScreenProps>;
  screen?: ComponentType<RecoveryScreenProps>;
}

export const RecoveryViewsContext = createContext<RecoveryViews | null>(null);

/**
 * - `updating`: the code is from a build that is no longer served; one reload is on its way.
 * - `offline`: the code could not be fetched without a connection; it reloads on reconnect.
 * - `failed`: anything else. The person reloads.
 */
type Phase = "updating" | "offline" | "failed";

interface Recovery {
  /** What was thrown, as thrown. A boundary can be handed a second failure while mounted. */
  thrown: unknown;
  error: Error;
  category: ErrorCategory;
  /** A dynamic import failed. Only a full reload retries one: the rejection is kept for the document. */
  missingCode: boolean;
  phase: Phase;
}

interface ErrorRecoveryProps {
  error: unknown;
  view: RecoveryView;
  /** Names the boundary in reports. */
  boundary: string;
  /** Read when the report is made, which is after a class boundary's `componentDidCatch`. */
  componentStack?: RefObject<string | null>;
}

const UNHANDLED = Symbol("unhandled");

/** A route can fail with anything: an error, a thrown response, a string, or nothing at all. */
function toError(thrown: unknown): Error {
  if (thrown instanceof Error) return thrown;
  if (isRouteErrorResponse(thrown)) {
    const detail = typeof thrown.data === "string" ? thrown.data : "";
    return new Error(`${thrown.status} ${thrown.statusText}${detail ? `: ${detail}` : ""}`.trim());
  }
  if (typeof thrown === "string") return new Error(thrown);
  if (thrown && typeof thrown === "object" && "message" in thrown) {
    const error = new Error(String(thrown.message));
    if ("stack" in thrown && typeof thrown.stack === "string") error.stack = thrown.stack;
    return error;
  }
  return new Error("Unknown error");
}

function begin(thrown: unknown): Recovery {
  const error = toError(thrown);
  const category = classifyErrorMessage(error.message);
  const missingCode = isChunkLoadErrorMessage(error.message);
  const phase: Phase =
    category === "chunk" && !hasChunkReloadAttempt()
      ? "updating"
      : missingCode && category === "offline"
        ? "offline"
        : "failed";
  return { thrown, error, category, missingCode, phase };
}

function reloadOnReconnect(boundary: string) {
  // Best effort: if the code still cannot be fetched, the reloaded page does not reload again.
  markChunkReloadAttempt();
  logger.info(`[${boundary}] The connection is back; reloading`);
  window.location.reload();
}

/**
 * Recovery for every boundary in the client: what kind of failure this is, the one automatic
 * reload onto a new build, the reload when a connection returns, and the report. What is drawn
 * depends only on where the failure is shown.
 */
export function ErrorRecovery({ error, view, boundary, componentStack }: ErrorRecoveryProps) {
  const views = useContext(RecoveryViewsContext);
  const [state, setState] = useState(() => begin(error));
  // The boundary stays mounted when the next page fails too; that failure starts its own recovery.
  const recovery = state.thrown === error ? state : begin(error);
  if (recovery !== state) setState(recovery);

  const handled = useRef<unknown>(UNHANDLED);
  useEffect(() => {
    // Once per failure: not again on a later render, nor on Strict Mode's second pass.
    if (handled.current === recovery.thrown) return;
    handled.current = recovery.thrown;

    if (recovery.phase === "updating") {
      // The mark is what keeps this to one reload: the reloaded page finds it and stops. The
      // static loading screen is left as it is, so nothing flashes between it and the reload.
      if (markChunkReloadAttempt()) {
        logger.warn(`[${boundary}] Code from an older build is gone; reloading once`, {
          message: recovery.error.message,
        });
        window.location.reload();
        return;
      }
      logger.warn(`[${boundary}] The reload mark cannot be kept; leaving the reload to the person`);
      setState({ ...recovery, phase: "failed" });
    }

    // The static loading screen stays up until the app is ready. It is not going to be.
    (window as Window & { __GG_MARK_BOOT_FAILED?: () => void }).__GG_MARK_BOOT_FAILED?.();

    logger.error(`[${boundary}] caught an error`, {
      message: recovery.error.message,
      category: recovery.category,
    });
    // The category rides in the boundary's name so reports can be split by failure mode.
    trackErrorBoundary(recovery.error, {
      componentStack: componentStack?.current,
      boundaryName: `${boundary}:${recovery.category}`,
      isOffline: recovery.category === "offline",
      isNetwork: recovery.category === "network",
    });

    // The connection may have come back before this screen could listen for it.
    if (recovery.phase === "offline" && navigator.onLine !== false) reloadOnReconnect(boundary);
  }, [recovery, boundary, componentStack]);

  const waiting = recovery.phase === "offline";
  useEventListener(waiting ? window : null, "online", () => {
    if (navigator.onLine === false) return;
    // Leaves the waiting state, so a second event does not reload a second time.
    setState({ ...recovery, phase: "updating" });
    reloadOnReconnect(boundary);
  });

  const reload = () => {
    // Without a connection the code cannot arrive, and on the website a reload would trade this
    // page for the browser's own offline page. The reconnect above reloads it.
    if (recovery.missingCode && navigator.onLine === false) return;
    if (recovery.missingCode) markChunkReloadAttempt();
    window.location.reload();
  };

  // Both entry files provide the screens outside every boundary; a tree without them is a
  // mistake in the entry, not a state to recover from.
  if (!views) throw new Error("ErrorRecovery needs the entry's RecoveryViewsContext");

  // A presentation that has no screen for this place shows its frame's: the larger failure.
  const Screen = view === "frame" ? undefined : views[view];
  if (!Screen) {
    const Frame = views.frame;
    return recovery.phase === "updating" ? (
      <Frame updating />
    ) : (
      <Frame offline={waiting} onReload={reload} />
    );
  }
  // Inside a frame the reload replaces the page before anything here would be read.
  if (recovery.phase === "updating") return null;
  return <Screen offline={waiting} onReload={reload} />;
}
