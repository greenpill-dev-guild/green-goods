/**
 * `resolveGardenQuery` unit tests.
 *
 * Locks the Phase 2 P2-5 contract: the Fund view classifies a `?garden=`
 * query into one of four states (absent / match / stale / ambiguous) before
 * deciding whether to fire the toast banner. Extracted from `Fund.tsx` so
 * the resolution logic can be exercised without pulling the wallet runtime
 * imports through the test transformer (the historic `fund.test.tsx` route
 * does not load in this worktree environment).
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from "vitest";

// Stubbed `deriveSlug` mirrors the shared helper without pulling the wallet
// runtime barrel into this test (the worktree environment cannot resolve
// `@walletconnect/utils` -> `uint8arrays`).
function fakeDeriveSlug(name: string, id: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug}-${id.slice(2, 8)}`;
}

vi.mock("@green-goods/shared", () => ({
  publicGardenHelpers: { deriveSlug: fakeDeriveSlug },
}));

import { resolveGardenQuery } from "../../views/Public/garden-query-resolution";

interface MinimalGarden {
  id: string;
  address: string;
  name: string;
}

const solar: MinimalGarden = {
  id: "0x1111111111111111111111111111111111111111",
  address: "0x1111111111111111111111111111111111111111",
  name: "Solar Community Garden",
};

const compost: MinimalGarden = {
  id: "0x2222222222222222222222222222222222222222",
  address: "0x2222222222222222222222222222222222222222",
  name: "Urban Composting Hub",
};

describe("resolveGardenQuery", () => {
  it("returns absent for null or empty queries", () => {
    expect(resolveGardenQuery(null, [solar])).toEqual({ status: "absent" });
    expect(resolveGardenQuery("", [solar])).toEqual({ status: "absent" });
    expect(resolveGardenQuery("   ", [solar])).toEqual({ status: "absent" });
  });

  it("matches by exact id (case-insensitive)", () => {
    const result = resolveGardenQuery(solar.id.toUpperCase(), [solar, compost]);
    expect(result.status).toBe("match");
    expect(result.garden?.id).toBe(solar.id);
    expect(result.rawQuery).toBe(solar.id.toUpperCase());
  });

  it("matches by derived slug when the query is a unique slug", () => {
    const slug = fakeDeriveSlug(solar.name, solar.id);
    const result = resolveGardenQuery(slug, [solar, compost]);
    expect(result.status).toBe("match");
    expect(result.garden?.id).toBe(solar.id);
  });

  it("returns ambiguous when more than one garden derives the same slug", () => {
    // Two gardens with identical names AND identical id prefixes collide
    // under the slug derivation, so the ambiguous branch fires.
    const twin: MinimalGarden = {
      id: solar.id.slice(0, 8) + "9999999999999999999999999999999999",
      address: solar.id.slice(0, 8) + "9999999999999999999999999999999999",
      name: solar.name,
    };
    const slug = fakeDeriveSlug(solar.name, solar.id);
    const result = resolveGardenQuery(slug, [solar, twin]);
    expect(result.status).toBe("ambiguous");
    expect(result.garden).toBeUndefined();
    expect(result.rawQuery).toBe(slug);
  });

  it("returns stale for a non-empty query with no match", () => {
    const result = resolveGardenQuery("does-not-exist", [solar, compost]);
    expect(result.status).toBe("stale");
    expect(result.garden).toBeUndefined();
    expect(result.rawQuery).toBe("does-not-exist");
  });
});
