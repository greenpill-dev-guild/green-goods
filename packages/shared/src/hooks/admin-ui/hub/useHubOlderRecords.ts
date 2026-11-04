import { useCallback, useEffect, useMemo, useState } from "react";
import type { GardenListPages } from "../../../types/garden-detail";
import { useOnlineStatus } from "../../app/useOnlineStatus";
import type { HubPipelineStage, SortDirection } from "./hub.utils";
import type { HubOlderRecords } from "./hub.workbenchModel";

/**
 * A list's next page, asked for and tracked until it lands. Widening a window
 * leaves nothing older to show until the wider read arrives, so a page asked
 * for counts as on its way until the garden's list next reads successfully. A
 * read that fails leaves it so, which keeps the control on screen, and asking
 * again then rereads the same width instead of widening further. Offline the
 * control stays, without its button, since no page can be read.
 */
function useNextPage(
  { hasOlder, loadOlder, reread, isLoadingOlder, readAt }: GardenListPages,
  garden: string | undefined,
  isOnline: boolean
) {
  // The garden and its list's read time when a page was last asked for.
  const [asked, setAsked] = useState<{ garden?: string; readAt?: number } | null>(null);
  const onItsWay = asked !== null && asked.garden === garden && asked.readAt === readAt;
  const ask = useCallback(() => {
    if (onItsWay && !isLoadingOlder) {
      reread();
      return;
    }
    setAsked({ garden, readAt });
    loadOlder();
  }, [garden, isLoadingOlder, loadOlder, onItsWay, readAt, reread]);
  const control = useMemo<HubOlderRecords | undefined>(() => {
    if (!hasOlder && !onItsWay) return undefined;
    return isOnline
      ? { onShowOlder: ask, isLoading: onItsWay && isLoadingOlder }
      : { isLoading: false };
  }, [ask, hasOlder, isLoadingOlder, isOnline, onItsWay]);
  return { hasOlder, onItsWay, ask, control };
}

/**
 * How the Hub reaches records older than the newest page its lists read: the
 * Work and Hypercerts tabs say when the garden has more and read the next page
 * on request. Oldest first needs the whole history, since a garden's oldest
 * work is on its last page, so that order reads the rest, page after page,
 * before the tab lists anything, as the installed app's garden Work tab does.
 * A failed or paused work read must end that reading, since its page never
 * lands.
 */
export function useHubOlderRecords({
  garden,
  stage,
  sortDirection,
  workPages,
  hypercertPages,
  workReadable,
}: {
  /** The garden in the header, whose lists these are. */
  garden: string | undefined;
  stage: HubPipelineStage;
  sortDirection: SortDirection;
  workPages: GardenListPages;
  hypercertPages: GardenListPages;
  /** False while the work read is failing or paused, when no older page can land. */
  workReadable: boolean;
}) {
  const isOnline = useOnlineStatus();
  const work = useNextPage(workPages, garden, isOnline);
  const hypercerts = useNextPage(hypercertPages, garden, isOnline);

  const wantsWorkHistory =
    isOnline && workReadable && stage === "work" && sortDirection === "oldest";
  const { hasOlder: workHasOlder, onItsWay: workPageOnItsWay, ask: askWorkPage } = work;
  useEffect(() => {
    if (wantsWorkHistory && workHasOlder && !workPageOnItsWay) askWorkPage();
  }, [askWorkPage, wantsWorkHistory, workHasOlder, workPageOnItsWay]);
  const readsWorkHistory = wantsWorkHistory && (workHasOlder || workPageOnItsWay);

  return {
    olderWork: readsWorkHistory ? undefined : work.control,
    olderHypercerts: hypercerts.control,
    readsWorkHistory,
  };
}
