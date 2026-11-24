/**
 * Garden membership tests: which roles an account holds in a garden, read from the garden's
 * record, and which gardens are the account's own (spec decision 2).
 */

import { describe, expect, it } from "vitest";
import {
  canSubmitWork,
  gardenMembership,
  isMyGarden,
  listMyGardens,
  type MemberRole,
} from "../../../modules/garden/membership";

const ACCOUNT = "0xa11ce00000000000000000000000000000000001";
// The indexer returns checksummed addresses; accounts arrive lower-cased.
const ACCOUNT_AS_LISTED = "0xA11CE00000000000000000000000000000000001";
const OTHER = "0xb0b0000000000000000000000000000000000002";

describe("gardenMembership", () => {
  it.each([
    ["owner", "owners"],
    ["steward", "stewards"],
    ["evaluator", "evaluators"],
    ["gardener", "gardeners"],
  ] as const)("reads the %s role from the garden's %s list", (role, list) => {
    const membership = gardenMembership({ [list]: [OTHER, ACCOUNT_AS_LISTED] }, ACCOUNT);

    expect(membership).toEqual({ roles: [role], pendingJoin: false });
    expect(isMyGarden(membership)).toBe(true);
    expect(gardenMembership({ [list]: [OTHER] }, ACCOUNT).roles).toEqual([]);
  });

  it("lists every role the account holds, owner first", () => {
    const garden = { gardeners: [ACCOUNT], evaluators: [ACCOUNT], owners: [ACCOUNT], stewards: [] };

    expect(gardenMembership(garden, ACCOUNT).roles).toEqual<MemberRole[]>([
      "owner",
      "evaluator",
      "gardener",
    ]);
  });

  it("does not make a depositor or community member a member", () => {
    const garden = { gardeners: [OTHER], funders: [ACCOUNT], communities: [ACCOUNT] };
    const membership = gardenMembership(garden, ACCOUNT);

    expect(membership).toEqual({ roles: [], pendingJoin: false });
    expect(isMyGarden(membership)).toBe(false);
  });

  // PRD-1311: a garden restored from an older build's cache had no `stewards` list, and
  // spreading it threw `e.stewards is not iterable` on /home.
  it.each([
    ["missing", undefined],
    ["null", null],
    ["an object", {}],
    ["a string", ACCOUNT],
  ])("reads the other lists when the stewards list is %s", (_shape, stewards) => {
    const garden = { gardeners: [ACCOUNT], stewards, owners: [OTHER] };

    expect(gardenMembership(garden, ACCOUNT).roles).toEqual(["gardener"]);
    expect(gardenMembership({}, ACCOUNT).roles).toEqual([]);
  });

  it("counts an open join the record does not show yet, and lets a listed role replace it", () => {
    const joining = gardenMembership({ gardeners: [OTHER] }, ACCOUNT, true);
    const listed = gardenMembership({ gardeners: [ACCOUNT] }, ACCOUNT, true);

    expect(joining).toEqual({ roles: [], pendingJoin: true });
    expect(isMyGarden(joining)).toBe(true);
    expect(listed).toEqual({ roles: ["gardener"], pendingJoin: false });
  });

  it.each([null, undefined, ""])("gives no roles to a missing account (%s)", (account) => {
    const membership = gardenMembership({ gardeners: [ACCOUNT], stewards: [""] }, account, true);

    expect(membership).toEqual({ roles: [], pendingJoin: false });
    expect(isMyGarden(membership)).toBe(false);
  });
});

describe("canSubmitWork", () => {
  // The work resolver accepts gardeners, stewards and owners (Garden.sol `isGardener` and
  // `isOperator`); an evaluator alone cannot submit work.
  it.each([
    [{ roles: ["gardener"], pendingJoin: false }, true],
    [{ roles: ["steward"], pendingJoin: false }, true],
    [{ roles: ["owner"], pendingJoin: false }, true],
    [{ roles: [], pendingJoin: true }, true],
    [{ roles: ["evaluator"], pendingJoin: false }, false],
    [{ roles: [], pendingJoin: false }, false],
  ] as const)("answers %o with %s", (membership, expected) => {
    expect(
      canSubmitWork({ roles: [...membership.roles], pendingJoin: membership.pendingJoin })
    ).toBe(expected);
  });
});

describe("listMyGardens", () => {
  const gardens = [
    { id: "0xnewest", gardeners: [ACCOUNT] },
    { id: "0xvisited", gardeners: [OTHER] },
    { id: "0xjoined", gardeners: [] },
    { id: "0xevaluated", evaluators: [ACCOUNT_AS_LISTED] },
  ];

  it("keeps the list's order and leaves out gardens the account holds nothing in", () => {
    const pendingJoins = new Set(["0xjoined", "0xnewest"]);

    expect(listMyGardens(gardens, ACCOUNT, (gardenId) => pendingJoins.has(gardenId))).toEqual([
      { garden: gardens[0], membership: { roles: ["gardener"], pendingJoin: false } },
      { garden: gardens[2], membership: { roles: [], pendingJoin: true } },
      { garden: gardens[3], membership: { roles: ["evaluator"], pendingJoin: false } },
    ]);
  });

  it("returns nothing for a missing account and works without a pending-join lookup", () => {
    expect(listMyGardens(gardens, null, () => true)).toEqual([]);
    expect(listMyGardens(gardens, ACCOUNT).map(({ garden }) => garden.id)).toEqual([
      "0xnewest",
      "0xevaluated",
    ]);
  });
});
