/**
 * GardenMembersList role-derivation tests
 *
 * Pins the role-set construction + per-address role lookup that drives the
 * cleanup A5 chip strip on the Garden Members tab. Lowercase normalization +
 * canonical display order are the two guarantees consumers depend on.
 *
 * Cleanup item A5 from .plans/active/admin-design-revamp/handoffs/claude-cleanup.md.
 */

import { describe, expect, it } from "vitest";

import {
  buildMemberRoleSets,
  memberRolesForAddress,
} from "@/views/Garden/components/GardenWorkspaceContent";
import type { Address } from "@green-goods/shared";

const A_LOWER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const A_MIXED = "0xAaAaaaAAAAaaaaaAAaaAAAAaaAAaaaaaaAaaaAaa" as Address;
const B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;
const C = "0xcccccccccccccccccccccccccccccccccccccccc" as Address;

describe("buildMemberRoleSets", () => {
  it("lowercases every address in every role set so lookups are case-safe", () => {
    const sets = buildMemberRoleSets({
      owners: [],
      operators: [A_MIXED],
      evaluators: [],
      gardeners: [],
      funders: [],
    });
    expect(sets.operator.has(A_LOWER)).toBe(true);
  });

  it("returns empty sets for an empty roster", () => {
    const sets = buildMemberRoleSets({
      owners: [],
      operators: [],
      evaluators: [],
      gardeners: [],
      funders: [],
    });
    expect(sets.owner.size + sets.operator.size + sets.evaluator.size).toBe(0);
    expect(sets.gardener.size + sets.funder.size).toBe(0);
  });

  it("does not collapse role sets across roles even when the same address appears in many", () => {
    const sets = buildMemberRoleSets({
      owners: [A_LOWER],
      operators: [A_LOWER],
      evaluators: [A_LOWER],
      gardeners: [A_LOWER],
      funders: [A_LOWER],
    });
    expect(sets.owner.has(A_LOWER)).toBe(true);
    expect(sets.operator.has(A_LOWER)).toBe(true);
    expect(sets.evaluator.has(A_LOWER)).toBe(true);
    expect(sets.gardener.has(A_LOWER)).toBe(true);
    expect(sets.funder.has(A_LOWER)).toBe(true);
  });
});

describe("memberRolesForAddress", () => {
  const sets = buildMemberRoleSets({
    owners: [A_LOWER],
    operators: [A_LOWER, B],
    evaluators: [B],
    gardeners: [A_LOWER, B, C],
    funders: [],
  });

  it("returns the empty array when the address holds no display roles", () => {
    expect(
      memberRolesForAddress("0xdead000000000000000000000000000000000000" as Address, sets)
    ).toEqual([]);
  });

  it("returns roles in canonical privilege order (owner → operator → evaluator → gardener → funder)", () => {
    expect(memberRolesForAddress(A_LOWER, sets)).toEqual(["owner", "operator", "gardener"]);
  });

  it("matches mixed-case input addresses against lowercase role sets", () => {
    expect(memberRolesForAddress(A_MIXED, sets)).toEqual(["owner", "operator", "gardener"]);
  });

  it("returns operator + evaluator + gardener for a multi-role member without owner", () => {
    expect(memberRolesForAddress(B, sets)).toEqual(["operator", "evaluator", "gardener"]);
  });

  it("returns gardener-only for a member whose only role is gardener", () => {
    expect(memberRolesForAddress(C, sets)).toEqual(["gardener"]);
  });

  it("excludes 'community' from the display roles even if a future caller passed it through", () => {
    // The exported display order is a const tuple; this test pins the
    // contract that consumers rely on for chip rendering.
    const roles = memberRolesForAddress(A_LOWER, sets);
    expect(roles).not.toContain("community");
  });
});
