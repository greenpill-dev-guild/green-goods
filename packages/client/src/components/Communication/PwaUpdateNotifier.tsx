import { createUpdateToasts } from "@green-goods/shared/components/Toast/presets/update";
import { useApp } from "@green-goods/shared/providers/App";
import { useServiceWorkerUpdate } from "@green-goods/shared/hooks/app/useServiceWorkerUpdate";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useIntl } from "react-intl";

/**
 * How long the restarted app may take to get what it needs offline before the
 * reader is told about it. A new shell reuses every unchanged file from the
 * previous one, so this usually settles well inside the window and the reader
 * sees only "Updated" — the wait is announced only when it is real.
 */
const OFFLINE_READY_GRACE_MS = 1_500;

function ServiceWorkerUpdateNotifier() {
  const { formatMessage } = useIntl();
  const { phase, shouldPrompt, activateNow, checkForUpdate, dismissUpdate, restartedOnNewVersion } =
    useServiceWorkerUpdate();
  const announcedRestartRef = useRef(false);
  /** The phase the toasts last reflected, so a failure is answered once it has passed. */
  const shownPhaseRef = useRef(phase);
  /** Set while a retry from the failed toast is still waiting on its check. */
  const retryingRef = useRef(false);
  // Bind the i18n-aware update toasts so es/pt render instead of hardcoded English.
  const updateToasts = useMemo(() => createUpdateToasts(formatMessage), [formatMessage]);

  // A failed install recovers with a fresh check, not another activation. The
  // reader asked for it, so the toast follows the check through instead of
  // leaving the failure up, and a ready update is offered at once rather than
  // after the long-session wait. The hook logs and tracks a check that throws.
  const retryDownload = useCallback(
    function retry() {
      const offerRetry = () => updateToasts.failed(retry, dismissUpdate);
      retryingRef.current = true;
      updateToasts.checking();
      void checkForUpdate()
        .then((result) => {
          if (result === "ready") updateToasts.ready(activateNow, dismissUpdate);
          else if (result === "failed") offerRetry();
          else updateToasts.dismiss();
        }, offerRetry)
        .finally(() => {
          retryingRef.current = false;
        });
    },
    [activateNow, checkForUpdate, dismissUpdate, updateToasts]
  );

  // After an update-triggered reload, close the loop once on the new version.
  useEffect(() => {
    if (!restartedOnNewVersion || announcedRestartRef.current) return;
    announcedRestartRef.current = true;
    updateToasts.applied();

    let settled = false;
    let waitAnnounced = false;
    const grace = window.setTimeout(() => {
      if (settled) return;
      waitAnnounced = true;
      updateToasts.preparingOffline();
    }, OFFLINE_READY_GRACE_MS);

    // The restart landed on a new shell, so the tier that lets this app accept
    // work with no signal is fetched again. Imported here, not at the top: this
    // module reaches the job queue, which the public bundle must never carry.
    let unsubscribe: (() => void) | undefined;
    let disposed = false;
    void import("@green-goods/shared/service-worker")
      .then(({ schedulePwaShellPreparation }) => {
        if (disposed) return;
        unsubscribe = schedulePwaShellPreparation("priority", (status) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(grace);
          // Only close a loop the reader saw open; a silent success stays silent.
          // Every outcome closes it, including one that is not ready: a spinner
          // with no resolution is worse than plainly saying the app updated.
          if (!waitAnnounced) return;
          if (status === "ready") updateToasts.offlineReady();
          else updateToasts.applied();
        });
      })
      .catch(() => {
        settled = true;
        window.clearTimeout(grace);
      });

    return () => {
      disposed = true;
      window.clearTimeout(grace);
      unsubscribe?.();
    };
  }, [restartedOnNewVersion, updateToasts]);

  useEffect(() => {
    // A failure toast stays up until something replaces it, so answer it once
    // its phase has passed: offer a ready update now and clear anything else.
    // A retry from the failed toast answers it on its own.
    const previous = shownPhaseRef.current;
    shownPhaseRef.current = phase;
    const failurePassed =
      phase !== previous &&
      (previous === "error" || previous === "install-failed") &&
      !retryingRef.current;
    switch (phase) {
      case "waiting":
        if (shouldPrompt || failurePassed) updateToasts.ready(activateNow, dismissUpdate);
        return;
      case "activating":
        updateToasts.applying();
        return;
      case "error":
        // A timed-out activation may still finish on its own, so keep a retry in
        // reach instead of asking the reader to close the app.
        updateToasts.stalled(activateNow, dismissUpdate);
        return;
      case "install-failed":
        updateToasts.failed(retryDownload, dismissUpdate);
        return;
      default:
        if (failurePassed) updateToasts.dismiss();
        return;
    }
  }, [phase, shouldPrompt, activateNow, retryDownload, dismissUpdate, updateToasts]);

  return null;
}

export function PwaUpdateNotifier() {
  const { isPwaPresentation } = useApp();

  if (!isPwaPresentation) return null;

  return <ServiceWorkerUpdateNotifier />;
}
