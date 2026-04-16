import { formatAddress, type Work } from "@green-goods/shared";
import type { ActivityEvent, SortDirection } from "./hub.utils";

type ActionsMap = Map<number, { title: string }>;

interface Assessment {
  id: string;
  title?: string | null;
  description?: string | null;
  createdAt: number;
}

interface Hypercert {
  id: string;
}

export function filterPendingWorks(
  works: Work[],
  actionsMap: ActionsMap,
  search: string,
  sortDirection: SortDirection
): Work[] {
  const direction = sortDirection === "oldest" ? 1 : -1;

  return works
    .filter((work) => work.status === "pending")
    .filter((work) => {
      if (!search) return true;
      const actionTitle = actionsMap.get(work.actionUID)?.title?.toLowerCase() ?? "";
      const gardener = formatAddress(work.gardenerAddress, { variant: "card" }).toLowerCase();
      return (
        (work.title || "").toLowerCase().includes(search) ||
        actionTitle.includes(search) ||
        gardener.includes(search)
      );
    })
    .sort((a, b) => direction * (a.createdAt - b.createdAt));
}

export function filterAssessmentQueue(
  works: Work[],
  actionsMap: ActionsMap,
  search: string
): Work[] {
  return works
    .filter((work) => work.status === "approved")
    .filter((work) => {
      if (!search) return true;
      const actionTitle = actionsMap.get(work.actionUID)?.title?.toLowerCase() ?? "";
      return (
        (work.title || "").toLowerCase().includes(search) ||
        actionTitle.includes(search) ||
        formatAddress(work.gardenerAddress, { variant: "card" }).toLowerCase().includes(search)
      );
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function filterCertificationQueue(
  assessments: Assessment[],
  hypercerts: Hypercert[],
  search: string
): Assessment[] {
  return assessments
    .filter((assessment) => !hypercerts.some((item) => item.id === assessment.id))
    .filter((assessment) => {
      if (!search) return true;
      return (
        (assessment.title || "").toLowerCase().includes(search) ||
        (assessment.description || "").toLowerCase().includes(search)
      );
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function filterHistoryEvents(
  events: ActivityEvent[],
  search: string,
  sortDirection: SortDirection
): ActivityEvent[] {
  const filtered = events.filter((event) => {
    if (!search) return true;
    return (
      event.title.toLowerCase().includes(search) || event.description.toLowerCase().includes(search)
    );
  });

  return [...filtered].sort((a, b) =>
    sortDirection === "oldest" ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
  );
}
