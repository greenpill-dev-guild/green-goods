import { useEffect, useRef } from "react";
import { logger } from "../../modules/app/logger";
import { useWorkFlowStore } from "../../stores/useWorkFlowStore";

/** Only a committed retirement may leave the composer, and only in its original account. */
export function useWorkDraftRetirement({
  completed,
  paused,
  attempt,
  clearActiveDraft,
  schedule,
  navigate,
}: {
  completed: boolean;
  paused: boolean;
  attempt: number;
  clearActiveDraft: (mode: "retire") => Promise<void>;
  schedule: (callback: () => void, delay: number) => void;
  navigate: () => void;
}) {
  const latestNavigation = useRef(navigate);
  latestNavigation.current = navigate;
  useEffect(() => {
    if (!completed || paused) return;
    let cancelled = false;
    const scope = useWorkFlowStore.getState().draftScope;
    void clearActiveDraft("retire")
      .then(() => {
        if (cancelled || useWorkFlowStore.getState().draftScope !== scope) return;
        const generation = useWorkFlowStore.getState().draftEpoch;
        schedule(() => {
          const current = useWorkFlowStore.getState();
          if (cancelled || current.draftScope !== scope || current.draftEpoch !== generation)
            return;
          latestNavigation.current();
          current.setSubmissionCompleted(false);
        }, 800);
      })
      .catch((error) => logger.error("Failed to retire work draft", { error }));
    return () => {
      cancelled = true;
    };
  }, [completed, paused, attempt, clearActiveDraft, schedule]);
}
