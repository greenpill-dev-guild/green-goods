/** @vitest-environment node */
import { zeroHash } from "viem";
import { describe, expect, it, vi } from "vitest";

import { createCommitmentLandedLookup } from "../../modules/job-queue/commitment-landed-lookup";
import type { CommitmentEventRecord } from "../../modules/commitment-pooling/types";
import type { Job } from "../../types/job-queue";

const CALLER = "0x1111111111111111111111111111111111111111";
const GARDEN = "0x2222222222222222222222222222222222222222";
const OTHER = "0x3333333333333333333333333333333333333333";
const TX = `0x${"ab".repeat(32)}` as const;
const OLD_TX = `0x${"cd".repeat(32)}` as const;
const SINCE_MS = 1_000_000_000;
const AFTER = SINCE_MS / 1000 + 60;

function act(kind: string, payload: Record<string, unknown>): Job {
  return {
    id: `job-${kind}`,
    kind,
    payload: { commitmentId: 7n, gardenAddress: GARDEN, ...payload },
    userAddress: CALLER,
    createdAt: SINCE_MS,
    attempts: 0,
    synced: false,
  } as Job;
}

function row(
  eventType: string,
  actor: string | null,
  extra: Partial<CommitmentEventRecord> = {}
): CommitmentEventRecord {
  return {
    id: `${eventType}-${actor}`,
    chainId: 42161,
    poolId: 1n,
    cycleId: null,
    commitmentId: 7n,
    eventType,
    actor: actor as CommitmentEventRecord["actor"],
    configurationKey: null,
    previousValue: null,
    newValue: null,
    units: null,
    data: null,
    txHash: TX,
    timestamp: AFTER,
    ...extra,
  };
}

async function lookUp(
  job: Job,
  rows: CommitmentEventRecord[],
  storedLink: `0x${string}` = zeroHash
) {
  const activity = vi.fn().mockResolvedValue(rows);
  const lookup = createCommitmentLandedLookup({
    readWorkLinkPayloadHash: vi.fn().mockResolvedValue(storedLink),
    activity,
  });
  return lookup({ job, chainId: 42161, sinceMs: SINCE_MS });
}

const takeUp = act("claim", { kind: 1, gardenContext: GARDEN });
const gardenTakeUp = act("claim", { kind: 0, gardenContext: GARDEN });
const proof = act("evidence", { clientEvidenceId: "proof", cid: "bafy-proof" });
const confirm = act("confirmation", { action: "confirm" });
const submit = act("confirmation", { action: "submit" });

describe("createCommitmentLandedLookup", () => {
  it.each([
    ["a take-up request by the reader", takeUp, [row("CLAIM_REQUESTED", CALLER)], "found"],
    [
      "a garden take-up the garden was accepted for",
      gardenTakeUp,
      [row("ACCEPTED", GARDEN)],
      "found",
    ],
    [
      "a request a steward has since declined",
      takeUp,
      [row("CLAIM_DECLINED", CALLER), row("CLAIM_REQUESTED", CALLER)],
      "absent",
    ],
    ["someone else's request", takeUp, [row("CLAIM_REQUESTED", OTHER)], "absent"],
    [
      "the proof's own CID",
      proof,
      [row("EVIDENCE_ATTACHED", CALLER, { data: "bafy-proof" })],
      "found",
    ],
    [
      "another proof by the same reader",
      proof,
      [row("EVIDENCE_ATTACHED", CALLER, { data: "bafy-other" })],
      "absent",
    ],
    ["the reader's confirmation", confirm, [row("CONFIRMATION_RECORDED", CALLER)], "found"],
    ["another confirmer's confirmation", confirm, [row("CONFIRMATION_RECORDED", OTHER)], "absent"],
    ["a commitment sent for confirmation", submit, [row("READY_FOR_CONFIRMATION", null)], "found"],
    [
      "a row from before the send",
      takeUp,
      [row("CLAIM_REQUESTED", CALLER, { timestamp: SINCE_MS / 1000 - 1, txHash: OLD_TX })],
      "absent",
    ],
  ])("reads %s", async (_case, job, rows, status) => {
    const result = await lookUp(job, rows);
    expect(result.status).toBe(status);
    if (status === "found") expect(result).toMatchObject({ transactionHash: TX });
  });

  it("decides a work link by the module's record, and waits for the log to name its transaction", async () => {
    const link = act("workLink", {
      clientOperationId: "op",
      operationKey: TX,
      requirementIndex: 0,
    });
    await expect(lookUp(link, [row("WORK_LINKED", CALLER)])).resolves.toEqual({ status: "absent" });
    await expect(lookUp(link, [row("WORK_LINKED", CALLER)], TX)).resolves.toEqual({
      status: "found",
      transactionHash: TX,
    });
    await expect(lookUp(link, [], TX)).resolves.toEqual({ status: "unknown" });
  });

  it("says unknown, not absent, when a full page may hide an older row", async () => {
    const busy = Array.from({ length: 200 }, (_, index) =>
      row("UNITS_COMMITTED", OTHER, { id: `row-${index}` })
    );
    await expect(lookUp(takeUp, busy)).resolves.toEqual({ status: "unknown" });
  });
});
