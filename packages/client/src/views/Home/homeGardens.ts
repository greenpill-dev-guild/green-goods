import type { ActiveGarden } from "@green-goods/shared/hooks/garden/useActiveGarden";
import { isGardenListedFor } from "@green-goods/shared/hooks/garden/useFilteredGardens";
import type { Garden } from "@green-goods/shared/types/domain";

/** One of the account's gardens with the account's roles in it (`useActiveGarden().myGardens`). */
export type MemberGarden = ActiveGarden["myGardens"]["gardens"][number];
export type MemberRole = MemberGarden["membership"]["roles"][number];

/** How the member stands with a garden on Explore's card: one tag on the photo, or none. */
export type ExploreTag = "member" | "awaiting" | "open";

/**
 * Explore's list (DL-125): the gardens the app lists, as the member's filters leave them, with
 * the member's own first and the rest in the listed order. Each card carries one tag: Member, a
 * request Awaiting review, or Open when anyone can join. Ids in both sets are lowercase.
 */
export function exploreGardens(
  listed: readonly Garden[],
  myGardenIds: ReadonlySet<string>,
  awaitingIds: ReadonlySet<string>
): Array<{ garden: Garden; tag: ExploreTag | null }> {
  const tagged = listed.map((garden) => {
    const id = garden.id.toLowerCase();
    const tag: ExploreTag | null = myGardenIds.has(id)
      ? "member"
      : awaitingIds.has(id)
        ? "awaiting"
        : garden.openJoining
          ? "open"
          : null;
    return { garden, tag };
  });
  return [
    ...tagged.filter(({ tag }) => tag === "member"),
    ...tagged.filter(({ tag }) => tag !== "member"),
  ];
}

/**
 * The listed gardens the member asked to join and does not belong to yet: a request waits for a
 * steward there, which is not membership (DL-123). A family garden kept for its members is never
 * among them, since a request there is a nonmember's (DL-126). Ids in both sets are lowercase.
 */
export function awaitingGardens(
  listed: readonly Garden[],
  awaitingIds: ReadonlySet<string>,
  myGardenIds: ReadonlySet<string>
): Garden[] {
  return listed.filter((garden) => {
    const id = garden.id.toLowerCase();
    return awaitingIds.has(id) && !myGardenIds.has(id) && isGardenListedFor(garden, false);
  });
}

/**
 * One row of the switcher or the first-login page: a garden, how the member stands with it, and
 * whether it is active.
 */
export interface SwitcherRow {
  garden: Garden;
  /** The member's first role (owner first), or `awaiting` for a request a steward has not answered. */
  standing: MemberRole | "awaiting";
  active: boolean;
}

/** What a row says about how the member stands with its garden. */
export const STANDING_LABEL_IDS = {
  owner: "app.roles.owner",
  steward: "app.roles.steward",
  evaluator: "app.roles.evaluator",
  gardener: "app.roles.gardener",
  awaiting: "app.home.awaitingReview",
} as const satisfies Record<SwitcherRow["standing"], string>;

/**
 * The rows of the switcher (DL-125) and the first-login page (DL-146): one per garden of the
 * member's in their list's order, each with the member's first role, then the gardens awaiting
 * review. An open join just sent stands in for the gardener role until the roster lists the
 * account.
 */
export function switcherRows(
  myGardens: readonly MemberGarden[],
  awaiting: readonly Garden[],
  activeGardenId: string | null
): SwitcherRow[] {
  const activeId = activeGardenId?.toLowerCase();
  return [
    ...myGardens.map(({ garden, membership }) => ({
      garden,
      standing: membership.roles[0] ?? ("gardener" as const),
      active: garden.id.toLowerCase() === activeId,
    })),
    ...awaiting.map((garden) => ({ garden, standing: "awaiting" as const, active: false })),
  ];
}
