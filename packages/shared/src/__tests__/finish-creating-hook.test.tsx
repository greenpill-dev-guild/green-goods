/** @vitest-environment happy-dom */

/**
 * Finish Creating: the group's copies waiting in the queue, and only those, are
 * sent as they were built, and a declined prompt leaves them waiting.
 */

import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useFinishCreating } from "../hooks/admin-ui/pool/useFinishCreating";
import type { CreationSendInput } from "../modules/commitment-pooling/creation-send";
import type { Address } from "../types/domain";
import { renderHookWithProviders } from "./test-utils/render-helpers";

const STEWARD = "0x1111111111111111111111111111111111111111" as Address;

const sent = vi.hoisted(() => ({ inputs: [] as CreationSendInput[] }));

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
vi.mock("../modules/commitment-pooling/creation-send", () => ({
  sendCreationCopies: vi.fn(async (input: CreationSendInput) => {
    sent.inputs.push(input);
    return input.copies.map((copy) => ({
      clientCommitmentId: copy.clientCommitmentId,
      status: "not-sent",
      miss: "declined",
      txHash: null,
      jobId: "job",
    }));
  }),
}));
vi.mock("../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => ({ authMode: "wallet" }),
}));

describe("useFinishCreating", () => {
  it("sends only this group's waiting copies on this chain, and a declined prompt keeps them", async () => {
    const view = renderHookWithProviders(() =>
      useFinishCreating({ chainId: 42161, owner: STEWARD })
    );

    let outcome: string | undefined;
    await act(async () => {
      outcome = await view.result.current.finish("group-00000001");
    });

    expect(outcome).toBe("left");
    const [input] = sent.inputs;
    expect(input?.copies.map((copy) => copy.clientCommitmentId)).toEqual(["copy-1", "copy-5"]);
    expect(input?.clearable?.("group-00000001")).toBe(false);
  });
});
