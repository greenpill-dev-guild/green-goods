/**
 * Home's garden lists: Explore's order and tags, and the switcher's rows (DL-125). Pure rules
 * over the account's gardens, the requests waiting for a steward, and the active garden.
 */

import type { Garden } from "@green-goods/shared/types/domain";
import { describe, expect, it } from "vitest";
import {
  awaitingGardens,
  exploreGardens,
  type MemberGarden,
  switcherRows,
} from "../../views/Home/homeGardens";

// Only what the rules read: an id, a name and whether anyone can join.
const garden = (suffix: string, overrides: Partial<Garden> = {}) =>
  ({
    id: `0xAbC00000000000000000000000000000000000${suffix}`,
    name: `Garden ${suffix}`,
    ...overrides,
  }) as Garden;

const ids = (set: string[]) => new Set(set.map((id) => id.toLowerCase()));
const mine = (g: Garden, roles: MemberGarden["membership"]["roles"], pendingJoin = false) => ({
  garden: g,
  membership: { roles, pendingJoin },
});

describe("exploreGardens", () => {
  it("lists the member's own gardens first, the rest after them in the listed order", () => {
    const [a, b, c, d] = ["01", "02", "03", "04"].map((suffix) => garden(suffix));

    const listed = exploreGardens([a, b, c, d], ids([d.id, b.id]), ids([]));

    expect(listed.map(({ garden }) => garden.id)).toEqual([b.id, d.id, a.id, c.id]);
  });

  it("tags each card once: Member, then Waiting for approval, then Open", () => {
    const member = garden("01", { openJoining: true });
    const requested = garden("02", { openJoining: true });
    const open = garden("03", { openJoining: true });
    const closed = garden("04", { openJoining: false });

    const listed = exploreGardens(
      [member, requested, open, closed],
      ids([member.id]),
      ids([requested.id])
    );

    expect(listed.map(({ tag }) => tag)).toEqual(["member", "awaiting", "open", null]);
  });

  it("matches the account's gardens and requests whatever the case of their ids", () => {
    const g = garden("01");

    const [{ tag }] = exploreGardens([g], new Set([g.id.toUpperCase().toLowerCase()]), ids([]));

    expect(tag).toBe("member");
  });
});

describe("awaitingGardens", () => {
  it("keeps the listed gardens the member asked to join and does not yet belong to", () => {
    const [a, b, c] = ["01", "02", "03"].map((suffix) => garden(suffix));

    const awaiting = awaitingGardens([a, b, c], ids([a.id, b.id]), ids([b.id]));

    expect(awaiting.map(({ id }) => id)).toEqual([a.id]);
  });

  // A family garden kept for its members stays off Home and the switcher for everyone else, a
  // request there included (DL-126).
  it("never lists a family garden kept for its members, whatever request waits there", () => {
    const family = garden("01", {
      id: "0xF7b892886998DAe960D64a9db488336684F137A0",
      name: "Aiyeloja Family Garden",
    });
    const open = garden("02");

    const awaiting = awaitingGardens([family, open], ids([family.id, open.id]), ids([]));

    expect(awaiting.map(({ id }) => id)).toEqual([open.id]);
  });
});

describe("switcherRows", () => {
  it("gives each of the member's gardens its first role, then the gardens awaiting review", () => {
    const owned = garden("01");
    const tended = garden("02");
    const requested = garden("03");

    const rows = switcherRows(
      [mine(owned, ["owner", "steward"]), mine(tended, ["gardener"])],
      [requested],
      null
    );

    expect(rows.map(({ garden, standing }) => [garden.id, standing])).toEqual([
      [owned.id, "owner"],
      [tended.id, "gardener"],
      [requested.id, "awaiting"],
    ]);
  });

  it("marks only the active garden, whatever the case of its id", () => {
    const [a, b] = ["01", "02"].map((suffix) => garden(suffix));

    const rows = switcherRows(
      [mine(a, ["gardener"]), mine(b, ["steward"])],
      [],
      b.id.toLowerCase()
    );

    expect(rows.map(({ active }) => active)).toEqual([false, true]);
  });

  it("shows an open join just sent as a gardener, the role it stands in for", () => {
    const joined = garden("01");

    const [row] = switcherRows([mine(joined, [], true)], [], joined.id);

    expect(row.standing).toBe("gardener");
  });
});
