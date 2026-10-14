import { useServiceWorkerUpdate } from "@green-goods/shared/hooks/app/useServiceWorkerUpdate";
import { useQueueStats } from "@green-goods/shared/providers/JobQueue";
import { useEffect } from "react";

export function PwaBadgeCoordinator() {
  const { pending, failed } = useQueueStats();
  const { phase } = useServiceWorkerUpdate();

  useEffect(() => {
    if (
      typeof navigator.setAppBadge !== "function" ||
      typeof navigator.clearAppBadge !== "function"
    ) {
      return;
    }

    const unresolvedJobs = pending + failed;
    const updateWaiting = phase === "waiting";
    const operation =
      unresolvedJobs > 0
        ? navigator.setAppBadge(unresolvedJobs)
        : updateWaiting
          ? navigator.setAppBadge()
          : navigator.clearAppBadge();
    void operation.catch(() => undefined);
  }, [failed, pending, phase]);

  return null;
}
