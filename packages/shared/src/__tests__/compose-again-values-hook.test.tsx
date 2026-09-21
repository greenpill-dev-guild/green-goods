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
import type { Address } from "../types/domain";

const MAKER = "0x1111111111111111111111111111111111111111" as Address;
const SOMEONE_ELSE = "0x2222222222222222222222222222222222222222" as Address;

const mocks = vi.hoisted(() => ({
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
});
