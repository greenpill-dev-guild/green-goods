/**
 * Pure edits to the cached garden list behind optimistic membership writes.
 * `useGardenOperations` applies them to the `gardensKeys.byChain` query data.
 */

import type { Garden } from "../../types/domain";
import type { GardenRole } from "../../utils/blockchain/garden-roles";

type MembershipWrite = "add" | "remove";

const ROSTER_FIELD: Record<GardenRole, keyof Garden> = {
  gardener: "gardeners",
  steward: "stewards",
  evaluator: "evaluators",
  owner: "owners",
  funder: "funders",
  community: "communities",
};

function cachedRoster(garden: Garden, role: GardenRole): string[] {
  return (garden[ROSTER_FIELD[role]] as string[] | undefined) ?? [];
}

/** Whether the cached roster already lists `targetAddress` for `role`. */
export function isOnCachedRoster(
  gardens: Garden[],
  gardenId: string,
  role: GardenRole,
  targetAddress: string
): boolean {
  const garden = gardens.find((entry) => entry.id === gardenId);
  if (!garden) return false;
  const target = targetAddress.toLowerCase();
  return cachedRoster(garden, role).some((member) => member.toLowerCase() === target);
}

/** Add `targetAddress` to, or remove it from, one role's cached roster. */
export function applyOptimisticUpdate(
  gardens: Garden[],
  gardenId: string,
  role: GardenRole,
  operationType: MembershipWrite,
  targetAddress: string
): Garden[] {
  const target = targetAddress.toLowerCase();
  return gardens.map((garden) => {
    if (garden.id !== gardenId) return garden;

    const members = cachedRoster(garden, role);
    const listed = members.some((member) => member.toLowerCase() === target);
    const nextMembers =
      operationType === "add"
        ? listed
          ? members
          : [...members, target]
        : members.filter((member) => member.toLowerCase() !== target);

    return { ...garden, [ROSTER_FIELD[role]]: nextMembers };
  });
}

/**
 * The cached list after a write failed. Only an optimistic step that changed
 * the roster is undone: an add for someone already listed, or a remove for
 * someone who was not, changed nothing, and reversing it would erase (or
 * invent) a real member.
 */
export function rollBackFailedWrite(
  gardens: Garden[],
  gardenId: string,
  write: { memberType: GardenRole; operationType: MembershipWrite; targetAddress: string },
  wasOnRoster: boolean
): Garden[] {
  const changedRoster = write.operationType === "add" ? !wasOnRoster : wasOnRoster;
  if (!changedRoster) return gardens;
  const reverse: MembershipWrite = write.operationType === "add" ? "remove" : "add";
  return applyOptimisticUpdate(gardens, gardenId, write.memberType, reverse, write.targetAddress);
}
