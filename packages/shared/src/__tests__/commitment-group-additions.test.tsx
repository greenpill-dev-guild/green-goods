/** @vitest-environment happy-dom */

/**
 * Adding to a group and finishing one: new copies are the group's terms,
 * deadline, reward and metadata document under new creation ids, read from a
 * copy on chain; an Add fixes its copies and a Try Again sends only the ones
 * that didn't send; Finish Creating sends the group's queued copies, and only
 * those. How copies are sent is `creation-send`'s, proven over the real queue
 * in its own test; here it is scripted.
 */

import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type GroupToAddTo, useAddToGroup } from "../hooks/admin-ui/pool/useAddToGroup";
import { useFinishCreating } from "../hooks/admin-ui/pool/useFinishCreating";
import type { CreationCopy, CreationSendInput } from "../modules/commitment-pooling/creation-send";
import {
  canAddToGroup,
  type GroupTemplate,
  groupAdditionPayload,
  readGroupTemplate,
} from "../modules/commitment-pooling/group-additions";
import { buildCommitmentMetadata } from "../modules/commitment-pooling/metadata";
import type { SeedCopyProgress } from "../modules/commitment-pooling/seed-sets";
import type { Address } from "../types/domain";
import { renderHookWithProviders } from "./test-utils/render-helpers";

const STEWARD = "0x1111111111111111111111111111111111111111" as Address;
const OTHER = "0x2222222222222222222222222222222222222222" as Address;
const CONFIRMER = "0x3333333333333333333333333333333333333333" as Address;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const ZERO = "0x0000000000000000000000000000000000000000" as Address;

const chain = vi.hoisted(() => ({ creator: "0x1111111111111111111111111111111111111111" }));
const send = vi.hoisted(() => ({
  script: (_copy: CreationCopy): Partial<SeedCopyProgress> => ({ status: "created" }),
  inputs: [] as CreationSendInput[],
}));

/** A creation job in the queue, as Finish Creating reads it. */
const job = (id: string, group: string | null, chainId = 42161) => ({
  id,
  kind: "commitment",
  chainId,
  payload: {
    clientCommitmentId: `copy-${id}`,
    metadata: {
      version: 1,
      title: "Survey",
      ...(group ? { displayGroup: { version: 1, id: group } } : {}),
    },
  },
});

vi.mock("../modules/commitment-pooling/creation-send", () => ({
  creationSendMode: vi.fn(async () => "bundle"),
  sendCreationCopies: vi.fn(async (input: CreationSendInput) => {
    send.inputs.push({ ...input, copies: [...input.copies] });
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
vi.mock("../modules/job-queue/default-instance", () => ({
  jobQueue: {
    getJobs: vi.fn(async () => [
      job("1", "group-00000001"),
      job("2", "group-00000002"),
      job("3", null),
      job("4", "group-00000001", 10),
      job("5", "group-00000001"),
    ]),
  },
}));
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

beforeEach(() => {
  send.inputs = [];
  send.script = () => ({ status: "created" });
  chain.creator = STEWARD;
});

/** How `getCommitment` decodes a copy of a garden-work group, trimmed to what matters. */
const onChain = {
  poolId: 7n,
  cycleId: 12n,
  commitmentSeriesId: 0n,
  creator: STEWARD,
  direction: 1,
  commitmentType: 0,
  state: 0,
  claimType: 1,
  claimMode: 1,
  contributorPolicy: 1,
  domains: [2],
  requirements: [{ actionUID: 44n, domain: 2, requiredCount: 3, approvedCount: 1 }],
  dueDate: 1_792_000_000n,
  unitLabel: "hours",
  targetUnits: 4n,
  confirmationThreshold: 1,
  protocolFallbackEnabled: true,
  requiresAssessment: false,
  needUID: `0x${"0".repeat(64)}` as const,
  counterCommitmentId: 0n,
  metadataCID: "bafy-group-document",
  consideration: { rail: 2, source: ZERO, token: ZERO, amount: 38_865n },
  declaredUnitValue: 0n,
  declaredValueBasis: "",
};

const metadata = buildCommitmentMetadata({
  title: "Prune the orchard",
  displayGroup: { version: 1, id: "group-00000001" },
});

async function template(): Promise<GroupTemplate> {
  return readGroupTemplate(
    async (functionName) => (functionName === "getCommitment" ? onChain : [CONFIRMER]),
    9n
  );
}

describe("adding to a group", () => {
  it("makes a copy of the group's terms, deadline, reward and document under a new id", async () => {
    const copy = groupAdditionPayload({
      template: await template(),
      metadata,
      clientCommitmentId: "added-1",
      gardenAddress: GARDEN,
    });

    expect(copy).toMatchObject({
      clientCommitmentId: "added-1",
      poolId: 7n,
      cycleId: 12n,
      direction: 1,
      commitmentType: 0,
      claimType: 1,
      claimMode: 1,
      contributorPolicy: 1,
      // Direct creation, with the domains left to the contract.
      onBehalfOf: ZERO,
      domainTags: [],
      requirements: [{ actionUID: 44n, requiredCount: 3 }],
      dueDate: 1_792_000_000n,
      metadataCID: "bafy-group-document",
      metadata,
      confirmers: [CONFIRMER],
      consideration: { rail: 2, source: ZERO, token: ZERO, amount: 38_865n },
      gardenAddress: GARDEN,
    });
  });

  it("lets only the steward who created the group add to it, so it stays one row", async () => {
    expect(canAddToGroup(await template(), STEWARD)).toBe(true);
    expect(canAddToGroup(await template(), STEWARD.toUpperCase() as Address)).toBe(true);
    expect(canAddToGroup(await template(), OTHER)).toBe(false);
    expect(canAddToGroup(await template(), null)).toBe(false);
  });

  it("refuses to add to a commitment that isn't in a group", async () => {
    const onItsOwn = await template();
    expect(() =>
      groupAdditionPayload({
        template: onItsOwn,
        metadata: buildCommitmentMetadata({ title: "On its own" }),
        clientCommitmentId: "added-1",
        gardenAddress: GARDEN,
      })
    ).toThrow("group");
  });
});

describe("useAddToGroup", () => {
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
    const [first, retry] = send.inputs.map((input) => input.copies);
    expect(first).toHaveLength(5);
    expect(retry).toEqual(first!.slice(0, 2));
    expect(first!.every((copy) => copy.payload.dueDate === first![0]!.payload.dueDate)).toBe(true);
    expect(first![0]!.payload.metadataCID).toBe("bafy-group-document");
  });

  it("checks the deadline again on Try Again, and sends nothing once it has passed", async () => {
    const soon = BigInt(Math.floor(Date.now() / 1000) + 60);
    const { add } = setup({ dueDate: soon });
    send.script = () => ({ status: "not-sent", miss: "failed" });
    expect(await add(3)).toBe("left");

    const later = vi.spyOn(Date, "now").mockReturnValue((Number(soon) + 1) * 1000);
    try {
      expect(await add(3)).toBe("expired");
    } finally {
      later.mockRestore();
    }
    expect(send.inputs).toHaveLength(1);
  });

  it("adds nothing once the deadline has passed, or for a steward who didn't create the group", async () => {
    expect(await setup({ dueDate: 1n }).add(5)).toBe("expired");
    chain.creator = OTHER;
    expect(await setup().add(5)).toBe("not-creator");
    expect(send.inputs).toEqual([]);
  });
});

describe("useFinishCreating", () => {
  it("reads which of the steward's queued copies belong to which group on this chain", async () => {
    const view = renderHookWithProviders(() =>
      useFinishCreating({ chainId: 42161, owner: STEWARD })
    );
    await waitFor(() => expect(view.result.current.waiting.size).toBe(2));
    // A copy on another chain, or in no group, is no group's to count.
    expect([...view.result.current.waiting]).toEqual([
      ["group-00000001", ["1", "5"]],
      ["group-00000002", ["2"]],
    ]);
  });

  it("sends only this group's waiting copies on this chain, and a declined prompt keeps them", async () => {
    send.script = () => ({ status: "not-sent", miss: "declined" });
    const view = renderHookWithProviders(() =>
      useFinishCreating({ chainId: 42161, owner: STEWARD })
    );

    let outcome: string | undefined;
    await act(async () => {
      outcome = await view.result.current.finish("group-00000001");
    });

    expect(outcome).toBe("left");
    const [input] = send.inputs;
    expect(input?.copies.map((copy) => copy.clientCommitmentId)).toEqual(["copy-1", "copy-5"]);
    expect(input?.clearable?.("group-00000001")).toBe(false);
  });
});
