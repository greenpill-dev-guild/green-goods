/** @vitest-environment jsdom */

/**
 * useComposeAgainValues — who may start from which commitment.
 *
 * The button is only offered to whoever made the commitment, but a link can be
 * edited, so the rule is kept where the answers are read rather than where the
 * button is drawn. A refusal is nothing to start from, never an error: the
 * composer simply opens empty.
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useComposeAgainValues } from "../hooks/commitment-pooling/useComposeAgainValues";
import type { Action, Address } from "../types/domain";
import { createMockAction } from "./test-utils/mock-factories";

const MAKER = "0x1111111111111111111111111111111111111111" as Address;
const SOMEONE_ELSE = "0x2222222222222222222222222222222222222222" as Address;
const DAY_MS = 24 * 60 * 60 * 1000;

const mocks = vi.hoisted(() => ({
  actions: [] as Action[],
  detail: null as unknown,
  enabled: [] as boolean[],
}));

vi.mock("../hooks/commitment-pooling/useCommitmentPooling", () => ({
  useCommitment: (_input: unknown, options: { enabled?: boolean }) => {
    mocks.enabled.push(options.enabled !== false);
    return { detail: mocks.detail };
  },
}));
vi.mock("../hooks/commitment-pooling/useCommitmentMetadata", () => ({
  useCommitmentMetadataFor: () => ({ version: 1, title: "Bike repair afternoons" }),
}));
vi.mock("../hooks/blockchain/useBaseLists", () => ({
  useActions: () => ({ data: mocks.actions }),
}));

const commitment = {
  poolId: 7n,
  creator: MAKER,
  direction: "OFFER",
  commitmentType: "SUPPORT_SERVICE",
  unitLabel: "afternoons",
  targetUnits: 3n,
  claimMode: "OPEN",
  contributorPolicy: "OPEN",
  confirmers: [],
};

function values(overrides: Partial<Parameters<typeof useComposeAgainValues>[0]> = {}) {
  return renderHook(() =>
    useComposeAgainValues({
      chainId: 42161,
      fromCommitmentId: 9n,
      composer: "member",
      viewer: MAKER,
      poolId: 7n,
      ...overrides,
    })
  ).result.current;
}

describe("useComposeAgainValues", () => {
  beforeEach(() => {
    mocks.actions = [];
    mocks.detail = { commitment, requirements: [] };
    mocks.enabled = [];
  });

  it("starts the person who made the commitment from their own answers", () => {
    expect(values()).toMatchObject({ title: "Bike repair afternoons", unitLabel: "afternoons" });
  });

  it("gives a member nothing to start from on somebody else's commitment", () => {
    expect(values({ viewer: SOMEONE_ELSE })).toBeNull();
    expect(values({ viewer: null })).toBeNull();
  });

  it("lets a steward seed from any commitment in the pool, which is what seeding is", () => {
    expect(values({ composer: "steward", viewer: SOMEONE_ELSE })).toMatchObject({
      title: "Bike repair afternoons",
    });
  });

  it("refuses a commitment from another pool, whose actions and terms are not this one's", () => {
    expect(values({ poolId: 8n })).toBeNull();
    expect(values({ composer: "steward", poolId: 8n })).toBeNull();
    expect(values({ poolId: undefined })).toBeNull();
  });

  it("reads nothing at all for an ordinary empty composer", () => {
    expect(values({ fromCommitmentId: null })).toBeNull();
    expect(mocks.enabled).toEqual([false]);
  });

  it("carries a garden-work requirement only while its action can still take work", () => {
    const now = Date.now();
    // Action times are milliseconds, as getActions stores them.
    mocks.actions = [
      createMockAction({ id: "42161-44", startTime: now - DAY_MS, endTime: now + DAY_MS }),
      createMockAction({ id: "42161-45", startTime: now - 2 * DAY_MS, endTime: now - DAY_MS }),
    ];
    mocks.detail = {
      commitment: { ...commitment, commitmentType: "DOMAIN_IMPACT" },
      requirements: [
        { requirementIndex: 0, actionUID: 44n, requiredCount: 2 },
        { requirementIndex: 1, actionUID: 45n, requiredCount: 1 },
      ],
    };

    expect(values()?.requirements).toEqual([{ actionUID: "44", requiredCount: 2 }]);
  });
});
