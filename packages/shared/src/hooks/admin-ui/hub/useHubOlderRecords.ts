import { useCallback, useEffect, useMemo, useState } from "react";
import type { GardenListPages } from "../../../types/garden-detail";
import { useOnlineStatus } from "../../app/useOnlineStatus";
import type { HubPipelineStage, SortDirection } from "./hub.utils";
import type { HubOlderRecords } from "./hub.workbenchModel";

/**
 * A list's next page, asked for and tracked until it lands. Widening a window
 * leaves nothing older to show until the wider read arrives, so a page asked
 * for counts as on its way until the list next reads successfully. A read that
 * fails leaves it so, which keeps the control on screen to ask again.
 */
function useNextPage({ hasOlder, loadOlder, isLoadingOlder, readAt }: GardenListPages) {
  // The list's read time when its last page was asked for; null before any.
  const [askedAt, setAskedAt] = useState<number | undefined | null>(null);
  const onItsWay = askedAt !== null && askedAt === readAt;
  const ask = useCallback(() => {
    setAskedAt(readAt);
    loadOlder();
  }, [loadOlder, readAt]);
  const control = useMemo<HubOlderRecords | undefined>(
    () =>
      hasOlder || onItsWay
        ? { onShowOlder: ask, isLoading: onItsWay && isLoadingOlder }
        : undefined,
    [ask, hasOlder, isLoadingOlder, onItsWay]
  );
  return { hasOlder, onItsWay, ask, control };
}

/**
 * How the Hub reaches records older than the newest page its lists read: the
 * Work and Hypercerts tabs offer their next page while the garden has more,
 * online, where a page can be read. Oldest first needs the whole history,
 * since a garden's oldest work is on its last page, so that order reads the
 * rest, page after page, before the tab lists anything, as the installed app's
 * garden Work tab does. A failed or paused work read must end that reading,
 * since its page never lands.
 */
export function useHubOlderRecords({
  stage,
  sortDirection,
  workPages,
  hypercertPages,
  workReadable,
}: {
  stage: HubPipelineStage;
  sortDirection: SortDirection;
  workPages: GardenListPages;
  hypercertPages: GardenListPages;
  /** False while the work read is failing or paused, when no older page can land. */
  workReadable: boolean;
}) {
  const isOnline = useOnlineStatus();
  const work = useNextPage(workPages);
  const hypercerts = useNextPage(hypercertPages);

  const wantsWorkHistory =
    isOnline && workReadable && stage === "work" && sortDirection === "oldest";
  const { hasOlder: workHasOlder, onItsWay: workPageOnItsWay, ask: askWorkPage } = work;
  useEffect(() => {
    if (wantsWorkHistory && workHasOlder && !workPageOnItsWay) askWorkPage();
  }, [askWorkPage, wantsWorkHistory, workHasOlder, workPageOnItsWay]);
  const readsWorkHistory = wantsWorkHistory && (workHasOlder || workPageOnItsWay);

  return {
    olderWork: isOnline && !readsWorkHistory ? work.control : undefined,
    olderHypercerts: isOnline ? hypercerts.control : undefined,
    readsWorkHistory,
  };
}
