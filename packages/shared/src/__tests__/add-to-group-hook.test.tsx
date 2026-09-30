/** @vitest-environment happy-dom */

/**
 * useAddToGroup: what an Add fixes and what a Try Again sends. How copies are
 * sent is `creation-send`'s, proven over the real queue in its own test; here it
 * is scripted, and the chain read of the group's terms is a fixture.
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type GroupToAddTo, useAddToGroup } from "../hooks/admin-ui/pool/useAddToGroup";
import type { CreationCopy, CreationSendInput } from "../modules/commitment-pooling/creation-send";
import { buildCommitmentMetadata } from "../modules/commitment-pooling/metadata";
import type { SeedCopyProgress } from "../modules/commitment-pooling/seed-sets";
import type { Address } from "../types/domain";
import { renderHookWithProviders } from "./test-utils/render-helpers";

const STEWARD = "0x1111111111111111111111111111111111111111" as Address;
const OTHER = "0x2222222222222222222222222222222222222222" as Address;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;

const chain = vi.hoisted(() => ({ creator: "0x1111111111111111111111111111111111111111" }));
const send = vi.hoisted(() => ({
  script: (_copy: CreationCopy): Partial<SeedCopyProgress> => ({ status: "created" }),
  calls: [] as CreationCopy[][],
}));

vi.mock("../modules/commitment-pooling/creation-send", () => ({
  creationSendMode: vi.fn(async () => "bundle"),
  sendCreationCopies: vi.fn(async (input: CreationSendInput) => {
    send.calls.push([...input.copies]);
    return input.copies.map((copy) => {
      const progress = {
        clientCommitmentId: copy.clientCommitmentId,
        txHash: null,
        jobId: "job",
        status: "created",
        ...send.script(copy),
      } as SeedCopyProgress;
      input.onCopy?.(progress);
      return progress;
    });
  }),
}));
vi.mock("../modules/job-queue/default-instance", () => ({ jobQueue: {} }));
vi.mock("../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => ({ authMode: "wallet" }),
}));
vi.mock("../hooks/commitment-pooling/useCommitmentPoolMutations", () => ({
  resolveCommitmentPoolingModule: () => "0x9999999999999999999999999999999999999999",
}));
vi.mock("../utils/blockchain/contracts", () => ({
  CommitmentPoolingModuleABI: [],
  createClients: () => ({
    publicClient: {
      readContract: async ({ functionName }: { functionName: string }) =>
        functionName === "getConfirmers"
          ? []
          : {
              poolId: 7n,
              cycleId: 12n,
              commitmentSeriesId: 0n,
              creator: chain.creator,
              direction: 1,
              commitmentType: 1,
              claimType: 1,
              claimMode: 0,
              contributorPolicy: 1,
              requirements: [],
              dueDate: 1n,
              unitLabel: "survey",
              targetUnits: 1n,
              confirmationThreshold: 1,
              protocolFallbackEnabled: true,
              requiresAssessment: false,
              needUID: `0x${"0".repeat(64)}`,
              counterCommitmentId: 0n,
              metadataCID: "bafy-group-document",
              consideration: { rail: 0, source: GARDEN, token: GARDEN, amount: 0n },
              declaredUnitValue: 0n,
              declaredValueBasis: "",
            },
    },
  }),
}));

const inAWeek = () => BigInt(Math.floor(Date.now() / 1000) + 7 * 86_400);

function setup(overrides: Partial<GroupToAddTo> = {}, owner: Address = STEWARD) {
  const group: GroupToAddTo = {
    displayGroupId: "group-00000001",
    dueDate: inAWeek(),
    templateCommitmentId: 9n,
    metadata: buildCommitmentMetadata({
      title: "Household water survey",
      displayGroup: { version: 1, id: "group-00000001" },
    }),
    gardenAddress: GARDEN,
    ...overrides,
  };
  const view = renderHookWithProviders(() => useAddToGroup({ chainId: 42161, owner, group }));
  const add = async (count: number) => {
    let outcome: string | undefined;
    await act(async () => {
      outcome = await view.result.current.add(count);
    });
    return outcome;
  };
  return { view, add };
}

beforeEach(() => {
  send.calls = [];
  send.script = () => ({ status: "created" });
  chain.creator = STEWARD;
});

describe("useAddToGroup", () => {
  it("fixes the added copies at the first Add, and Try Again sends only the ones that didn't send", async () => {
    const { view, add } = setup();
    let failing = 2;
    send.script = () =>
      failing-- > 0 ? { status: "not-sent", miss: "failed" } : { status: "created" };

    expect(await add(5)).toBe("left");
    expect(view.result.current.locked).toBe(true);
    expect(view.result.current.retryCount).toBe(2);

    // The count can't change once some of the addition exists.
    expect(await add(8)).toBe("sent");
    const [first, retry] = send.calls;
    expect(first).toHaveLength(5);
    expect(retry).toEqual(first!.slice(0, 2));
    expect(first!.every((copy) => copy.payload.dueDate === first![0]!.payload.dueDate)).toBe(true);
    expect(first![0]!.payload.metadataCID).toBe("bafy-group-document");
  });

  it("adds nothing once the deadline has passed, or for a steward who didn't create the group", async () => {
    expect(await setup({ dueDate: 1n }).add(5)).toBe("expired");
    chain.creator = OTHER;
    expect(await setup().add(5)).toBe("not-creator");
    expect(send.calls).toEqual([]);
  });
});
