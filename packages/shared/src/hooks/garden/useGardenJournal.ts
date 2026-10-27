/**
 * Home's journal reads for one garden (DL-127): Recent Activity, the open seasons and
 * campaigns, and the promises to take part in.
 *
 * They are the garden page's own reads under the same cache keys: its work list (`useWorks`
 * with the offline queue), its pool lookup, and its Pool tab's cycles and promises. Home and
 * those pages share every fetch and never disagree. Nothing here writes. The rules that pick
 * what each section shows live in `modules/garden/journal`.
 *
 * @module hooks/garden/useGardenJournal
 */

import { useMemo, useState } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import {
  featuredWork,
  JOURNAL_PREVIEW_COUNT,
  type JournalSectionState,
  type OpenCycle,
  openAsk,
  openCycles,
  poolSectionState,
  type RecentActivityState,
  recentActivityState,
  type TakePartEntry as JournalTakePartEntry,
  takePartEntries,
} from "../../modules/garden/journal";
import type { CommitmentReadModel } from "../../modules/commitment-pooling/types-core";
import type { Address, Work } from "../../types/domain";
import { findActionByUID } from "../../utils/action/parsers";
import { useOnlineStatus } from "../app/useOnlineStatus";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useActions } from "../blockchain/useBaseLists";
import { useCommitmentCycleNames } from "../commitment-pooling/useCommitmentCycleNames";
import { useCommitmentMetadata } from "../commitment-pooling/useCommitmentMetadata";
import {
  useCommitmentCycles,
  useCommitmentPools,
  useCommitments,
} from "../commitment-pooling/useCommitmentPooling";
import { useDueClock } from "../commitment-pooling/useDueClock";
import { useViewerTakeUps } from "../commitment-pooling/useViewerTakeUps";
import { useDocumentEvent } from "../utils/useEventListener";
import { useWorks } from "../work/useWorks";

/**
 * One Take Part entry: a promise as the Pool tab's row, or copies of one set as one group.
 * An alias, not a type re-export: Storybook's spy mock of this module would keep a re-exported
 * name as a runtime import.
 */
export type TakePartEntry = JournalTakePartEntry;

export interface GardenRecentActivity {
  state: RecentActivityState;
  /** The newest of the garden's works with a photo, the carousel's featured update. */
  featured: Work | null;
  /** The action a work was logged for, which names its row as on the Work tab. */
  actionTitleOf: (work: Work) => string | undefined;
  refetch: () => void;
}

export function useGardenRecentActivity(gardenId: string): GardenRecentActivity {
  const chainId = DEFAULT_CHAIN_ID;
  const read = useWorks(gardenId, { offline: true });
  const { data: actions } = useActions(chainId);
  const { works, availability, isError, isPaused, lastSuccessfulRefresh } = read;
  const result = useMemo(
    () => ({
      state: recentActivityState({ works, availability, isError, isPaused, lastSuccessfulRefresh }),
      featured: featuredWork(works),
      actionTitleOf: (work: Work) => findActionByUID(actions ?? [], work.actionUID)?.title,
    }),
    [actions, availability, isError, isPaused, lastSuccessfulRefresh, works]
  );
  return { ...result, refetch: read.refetch };
}

/** The garden's pool, as the garden page finds it: the first the indexer lists for the garden. */
function useGardenPool(gardenId: string) {
  const chainId = DEFAULT_CHAIN_ID;
  const pools = useCommitmentPools({ chainId, garden: gardenId as Address });
  return { chainId, pools, pool: pools.data?.[0] ?? null };
}

export interface JournalCycle extends OpenCycle {
  /** The name its stewards gave it, once its metadata has resolved. */
  name: string | null;
}

export interface GardenOpenCycles {
  state: JournalSectionState<JournalCycle>;
}

/**
 * The pool's open season and campaigns, read the way the Pool tab reads its rail. Days left
 * count from when the section was last brought into view: the tab shown again, or, for a
 * section Home keeps mounted under the pages it opens, `shown` turning true again, so a count
 * read before a day boundary never stands after it.
 */
export function useGardenOpenCycles(
  gardenId: string,
  { shown = true }: { shown?: boolean } = {}
): GardenOpenCycles {
  const isOnline = useOnlineStatus();
  const { chainId, pools, pool } = useGardenPool(gardenId);
  const cycles = useCommitmentCycles(
    { chainId, poolId: pool?.poolId ?? 0n },
    { enabled: pool !== null }
  );
  const [nowMs, setNowMs] = useState(Date.now);
  // Read in the render that shows the section again, so the count it paints is already current.
  const [wasShown, setWasShown] = useState(shown);
  if (shown !== wasShown) {
    setWasShown(shown);
    if (shown) setNowMs(Date.now());
  }
  useDocumentEvent("visibilitychange", () => {
    if (document.visibilityState === "visible") setNowMs(Date.now());
  });
  const open = useMemo(() => openCycles(cycles.data ?? [], nowMs), [cycles.data, nowMs]);
  const openRecords = useMemo(() => open.map(({ cycle }) => cycle), [open]);
  const { byCycleId } = useCommitmentCycleNames(openRecords);

  // Home draws the cycles only once read, so nothing here offers to read them again.
  const state = poolSectionState({
    available: pools.availability.status === "available",
    isOnline,
    pools: {
      hasData: pools.data !== undefined,
      hasPool: pool !== null,
      isError: pools.isError,
      dataUpdatedAt: pools.dataUpdatedAt,
    },
    list: {
      hasData: cycles.data !== undefined,
      isError: cycles.isError,
      dataUpdatedAt: cycles.dataUpdatedAt,
    },
    items: open.map((item) => ({
      ...item,
      name: byCycleId.get(item.cycle.cycleId.toString())?.name ?? null,
    })),
  });

  return { state };
}

export interface GardenOpenPromises {
  /** Take Part's first entries: the open promises, copies of one set as one row. */
  state: JournalSectionState<TakePartEntry>;
  /** Every entry, from the same read, for the sheet of open promises See All opens. */
  all: JournalSectionState<TakePartEntry>;
  /** The newest ask open to take up, from every entry, for the carousel. */
  ask: TakePartEntry | null;
  /** A promise's own name, once its metadata has resolved. */
  titleOf: (metadataCID: string | null | undefined) => string | null;
  refetch: () => void;
}

const NO_COMMITMENTS: CommitmentReadModel[] = [];

/**
 * The promises in the garden's pool that the reader could take part in: none they already
 * asked for or are taking up from this phone.
 */
export function useGardenOpenPromises(gardenId: string): GardenOpenPromises {
  const isOnline = useOnlineStatus();
  const viewer = usePrimaryAddress();
  const { chainId, pools, pool } = useGardenPool(gardenId);
  const commitments = useCommitments(
    { chainId, poolId: pool?.poolId ?? 0n },
    { enabled: pool !== null }
  );
  const {
    takeUps,
    settled,
    unavailable,
    retry: retryTakeUps,
  } = useViewerTakeUps({
    chainId,
    poolId: pool?.poolId ?? 0n,
    viewer,
    enabled: pool !== null,
  });
  const listed = commitments.data ?? NO_COMMITMENTS;
  const { byCID } = useCommitmentMetadata(listed);
  const poolOpen = pool?.state === "OPEN";
  // Ticks when a listed promise falls due, so a lapsed one leaves the list.
  const due = useDueClock({ chainId, poolId: pool?.poolId ?? null, commitments: listed });
  const entries = useMemo(
    () =>
      takePartEntries({
        commitments: listed,
        metadataByCID: byCID,
        viewer,
        poolOpen,
        takeUps,
        clock: due.clock,
      }),
    [listed, byCID, viewer, poolOpen, takeUps, due.clock]
  );

  const read = {
    available: commitments.availability.status === "available",
    isOnline,
    pools: {
      hasData: pools.data !== undefined,
      hasPool: pool !== null,
      isError: pools.isError,
      dataUpdatedAt: pools.dataUpdatedAt,
    },
    list: {
      // A request in flight would show an ask the reader asked for, then take it away, a queue
      // that cannot be read could offer again a take-up already on this phone, and an ask whose
      // cycle's end is unread may already be past due.
      hasData: commitments.data !== undefined && settled && !unavailable && due.known,
      isError: commitments.isError || unavailable || due.isError,
      dataUpdatedAt: commitments.dataUpdatedAt,
    },
  };
  const state = poolSectionState({ ...read, items: entries.slice(0, JOURNAL_PREVIEW_COUNT) });
  const all = poolSectionState({ ...read, items: entries });

  return {
    state,
    all,
    ask: state.status === "ready" ? openAsk(entries) : null,
    titleOf: (metadataCID) => (metadataCID ? (byCID.get(metadataCID.trim())?.title ?? null) : null),
    refetch: () => {
      if (pools.isError) void pools.refetch();
      if (commitments.isError) void commitments.refetch();
      if (unavailable) retryTakeUps();
      if (due.isError) due.retry();
    },
  };
}
