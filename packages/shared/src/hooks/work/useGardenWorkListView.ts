/**
 * useGardenWorkListView Hook
 *
 * The garden's Work tab: which work it shows and in what order. Type narrows
 * the list to one of the garden's actions, and Sort orders it; Pending first is
 * today's order and stays the default, so the tab opens as it always has.
 *
 * @module hooks/work/useGardenWorkListView
 */

import { useMemo, useState } from "react";
import type { Action, Work } from "../../types/domain";

/** How the Work tab orders its cards. */
export type GardenWorkSort = "pending" | "newest" | "oldest";

interface GardenWorkTypeOption {
  /** The action's number, the way a work's `actionUID` names it. */
  id: string;
  title: string;
}

interface GardenWorkListView {
  /** The work to show, narrowed to the chosen type and in the chosen order. */
  works: Work[];
  /**
   * The garden's actions that have work in the list, A to Z. Empty while fewer
   * than two do, since choosing the only one would show the same list.
   */
  typeOptions: GardenWorkTypeOption[];
  /** The chosen type, or "all" once the chosen one has nothing left in it. */
  type: string;
  /** Each action by the number a work names it with. */
  actionById: Map<string, Action>;
}

/** An action's number: the last part of its id, which a work's actionUID names. */
function actionNumber(action: Action): string | null {
  const part = String(action.id).split("-").pop();
  return part ? part : null;
}

const ORDER: Record<GardenWorkSort, (a: Work, b: Work) => number> = {
  // Work still waiting for review leads, newest first within each group.
  pending: (a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return b.createdAt - a.createdAt;
  },
  newest: (a, b) => b.createdAt - a.createdAt,
  oldest: (a, b) => a.createdAt - b.createdAt,
};

/**
 * The Work tab's list for a type and a sort. An action with no work in the list
 * is not offered, a single action is not offered either, and a chosen type that
 * has emptied falls back to all work, so the list never shows nothing while
 * work exists and Type only appears when it can narrow the list.
 */
export function selectGardenWorkList(
  works: Work[],
  actions: Action[],
  { type, sort }: { type: string; sort: GardenWorkSort }
): GardenWorkListView {
  const actionById = new Map<string, Action>();
  for (const action of actions) {
    const number = actionNumber(action);
    if (number) actionById.set(number, action);
  }
  const withWork = new Set(works.map((work) => String(work.actionUID)));
  const withWorkOptions = [...actionById.entries()]
    .filter(([id]) => withWork.has(id))
    .map(([id, action]) => ({ id, title: action.title }))
    .sort((left, right) => left.title.localeCompare(right.title));
  const typeOptions = withWorkOptions.length > 1 ? withWorkOptions : [];
  const activeType =
    type !== "all" && typeOptions.some((option) => option.id === type) ? type : "all";
  const shown =
    activeType === "all" ? works : works.filter((work) => String(work.actionUID) === activeType);
  return { works: [...shown].sort(ORDER[sort]), typeOptions, type: activeType, actionById };
}

export function useGardenWorkListView(works: Work[], actions: Action[]) {
  const [type, setType] = useState("all");
  const [sort, setSort] = useState<GardenWorkSort>("pending");
  const view = useMemo(
    () => selectGardenWorkList(works, actions, { type, sort }),
    [works, actions, type, sort]
  );
  return { ...view, sort, setType, setSort };
}
