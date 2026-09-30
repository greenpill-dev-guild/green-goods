import type { Address, Work } from "../../../types/domain";
import type { CommitmentsToConfirm } from "../../commitment-pooling/commitments-to-confirm.types";
import { formatAddress } from "../../../utils/app/text";
import type { SortDirection } from "./hub.utils";
import type { HubActionSummary } from "./hub.workbenchModel";

type ActionsMap = Map<number, HubActionSummary>;

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

type ConfirmQueueScope = Pick<CommitmentsToConfirm, "groups" | "fallback" | "disputed" | "count">;

/**
 * The Confirm stage for the garden in the header, like every other Hub stage:
 * what that garden's authority confirms (wherever the commitment lives), the
 * garden fallbacks it may step into, and the disputes in its own pool. The
 * protocol team's queue has its own home in Community → Coordination, so a
 * protocol fallback row never appears here. No garden selected, nothing listed.
 */
export function selectToConfirmForGarden<T extends ConfirmQueueScope>(
  toConfirm: T,
  garden: Address | null
): T {
  const isSelected = (address: Address) =>
    garden !== null && address.toLowerCase() === garden.toLowerCase();
  const groups = toConfirm.groups.filter((group) => isSelected(group.garden));
  const fallback = toConfirm.fallback.filter(
    (row) => row.path === "POOL_FALLBACK" && isSelected(row.garden)
  );
  const disputed = (toConfirm.disputed ?? []).filter((row) => isSelected(row.garden));
  const count =
    groups.reduce((sum, group) => sum + group.rows.length, 0) + fallback.length + disputed.length;
  return { ...toConfirm, groups, fallback, disputed, count };
}
