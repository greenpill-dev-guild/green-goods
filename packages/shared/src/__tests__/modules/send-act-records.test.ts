/**
 * Send act records (PRD-1553): every act that signs or sends records when it
 * started and how it ended, with no address and no message text, and a send
 * that may still land ends as still confirming.
 *
 * @direct-test-subject ../../modules/app/sendActAnalytics
 * @direct-test-subject ../../modules/commitment-pooling/send-act-outcome
 */

import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  batchSaveActOutcome,
  copiesEnding,
  noteUnconfirmedSend,
  recordedSendAct,
  recordSendAct,
  type SendActContext,
  sendActEnding,
} from "../../modules/app/sendActAnalytics";
import { registerTelemetrySink } from "../../modules/app/telemetry-sink";
import {
  copiesActEnding,
  copyActOutcome,
  issuerActOutcome,
  poolSetupActEnding,
  voucherAwardActOutcome,
} from "../../modules/commitment-pooling/send-act-outcome";
import type { PoolSetupOutcome } from "../../modules/commitment-pooling/pool-setup";
import {
  ReceiptWaitLimitError,
  TransactionConfirmationPendingError,
} from "../../modules/transactions/types";

const ADDRESS = "0x1111111111111111111111111111111111111111";
const NOTE = "a steward's private note";
const context: SendActContext = {
  act: "pool_lifecycle",
  operation: "pausePool",
  authMode: "wallet",
  chainId: 42161,
};

let captured: { event: string; properties: Record<string, unknown> }[] = [];
let unregister: () => void = () => {};

beforeEach(() => {
  captured = [];
  unregister = registerTelemetrySink({
    capture: (event, properties) => captured.push({ event, properties }),
  });
});

afterEach(() => unregister());

const ended = () => captured.find(({ event }) => event === "send_act_ended")?.properties;

function named(name: string, message = "wait ended") {
  const error = new Error(message);
  error.name = name;
  return error;
}

const userRejected = Object.assign(new Error("User rejected the request."), { code: 4001 });

describe("recordSendAct", () => {
  it("records the start, then one ending, around an act that lands", async () => {
    await expect(recordSendAct(context, async () => ({ hash: "0xabc" }))).resolves.toEqual({
      hash: "0xabc",
    });

    expect(captured.map(({ event }) => event)).toEqual(["send_act_started", "send_act_ended"]);
    expect(captured[0]!.properties).toMatchObject({
      act: "pool_lifecycle",
      operation: "pausePool",
      auth_mode: "wallet",
      chain_id: 42161,
    });
    expect(ended()).toMatchObject({ act: "pool_lifecycle", outcome: "confirmed" });
    expect(typeof ended()!.duration_ms).toBe("number");
    expect(ended()).not.toHaveProperty("session_id");
  });

  it("ends a send on record with no receipt yet as still confirming", async () => {
    await recordSendAct(context, async () => ({ hash: "0xabc", confirmation: "pending" }));

    expect(ended()).toMatchObject({ outcome: "confirming" });
  });

  it("reads a noted pending hash as confirming, unless the result says it landed", async () => {
    noteUnconfirmedSend({ hash: "0xAAA", confirmation: "pending" });
    noteUnconfirmedSend({ hash: "0xBBB", confirmation: "pending" });
    await recordSendAct(context, async () => "0xaaa");
    await recordSendAct(context, async () => ({ hash: "0xBBB", confirmation: undefined }));

    const endings = captured.filter(({ event }) => event === "send_act_ended");
    expect(endings.map(({ properties }) => properties.outcome)).toEqual([
      "confirming",
      "confirmed",
    ]);
  });

  it.each([
    ["a sender's receipt limit", new ReceiptWaitLimitError(120_000), "confirming"],
    [
      "a receipt limit wrapped as a cause",
      new Error("send failed", { cause: new ReceiptWaitLimitError(120_000) }),
      "confirming",
    ],
    ["viem's receipt timeout", named("WaitForTransactionReceiptTimeoutError"), "confirming"],
    ["a UserOperation timeout", named("WaitForUserOperationReceiptTimeoutError"), "confirming"],
    ["a send on record", new TransactionConfirmationPendingError(), "confirming"],
    ["a wallet answer nobody waited for", named("WalletAnswerAbandonedError"), "confirming"],
    ["a declined prompt", userRejected, "cancelled"],
    ["a revert", new Error("execution reverted"), "failed"],
  ])("ends %s as %s and rethrows it unchanged", async (_case, error, outcome) => {
    await expect(
      recordSendAct(context, async () => {
        throw error;
      })
    ).rejects.toBe(error);

    expect(ended()).toMatchObject({ outcome });
    expect(typeof ended()!.parsed_error_family).toBe("string");
  });

  it("sends no address and no message text, only the parsed error family", async () => {
    const error = new Error(`execution reverted for ${ADDRESS}: ${NOTE}`);

    await expect(
      recordSendAct(context, async () => {
        throw error;
      })
    ).rejects.toBe(error);

    const sent = JSON.stringify(captured);
    expect(sent).not.toMatch(/0x[0-9a-fA-F]{40}/);
    expect(sent).not.toContain(NOTE);
    expect(ended()).toMatchObject({ outcome: "failed", parsed_error_family: "ExecutionReverted" });
    const keys = new Set(captured.flatMap(({ properties }) => Object.keys(properties)));
    for (const key of ["error", "error_message", "address", "tx_hash", "session_id"])
      expect(keys).not.toContain(key);
  });

  it("keeps the act's own result and error when its ending cannot be read", async () => {
    await expect(
      recordSendAct(
        context,
        async () => "landed",
        () => {
          throw new Error("unreadable");
        }
      )
    ).resolves.toBe("landed");

    expect(ended()).toMatchObject({ outcome: "confirmed" });
  });
});

describe("recordedSendAct", () => {
  it("reads the context from the call's variables and forwards every argument", async () => {
    const send = recordedSendAct(
      (input: { action: string }) => ({ ...context, operation: input.action }),
      async (input: { action: string }, extra?: string) => `${input.action}:${extra}`
    );

    await expect(send({ action: "resumePool" }, "ctx")).resolves.toBe("resumePool:ctx");
    expect(captured[0]!.properties).toMatchObject({ operation: "resumePool" });
  });

  it("runs the act unrecorded when its context cannot be read", async () => {
    const send = recordedSendAct(
      (input: { token: { chainId: number } }) => ({ ...context, chainId: input.token.chainId }),
      async (_input: { token: { chainId: number } }) => "sent"
    );

    await expect(send(undefined as never)).resolves.toBe("sent");
    expect(captured).toEqual([]);
  });
});

describe("acts of several copies", () => {
  it.each([
    [["confirmed", "confirmed"], "confirmed", { copies_confirmed: 2 }],
    [["confirmed", "confirming", null], "partial", { copies_confirmed: 1, copies_confirming: 1 }],
    [[null], "failed", {}],
  ] as const)("ends %j as %s", async (outcomes, outcome, counts) => {
    expect(copiesEnding(outcomes).outcome).toBe(outcome);

    await recordSendAct(context, async () => outcomes, copiesEnding);
    expect(ended()).toMatchObject({ outcome, ...counts });
  });

  it.each([
    [{ status: "created" }, "confirmed"],
    [{ status: "changed" }, "confirmed"],
    [{ status: "later" }, "queued"],
    [{ status: "confirming" }, "confirming"],
    [{ status: "not-sent", miss: "declined" }, "cancelled"],
    [{ status: "not-changed", miss: "failed" }, "confirming"],
    [{ status: "not-sent", miss: "failed", jobId: "job-1" }, "confirming"],
    [{ status: "not-sent", miss: "failed", jobId: null }, "failed"],
    [{ status: "not-sent", miss: "refused" }, "failed"],
    [{ status: "not-sent", miss: "over-ceilings" }, "failed"],
    [{ status: "waiting" }, null],
  ] as const)("reads copy %j as %s", (copy, outcome) => {
    expect(copyActOutcome(copy)).toBe(outcome);
  });

  it("counts a pool act's copies by how each ended", () => {
    expect(
      copiesActEnding([
        { status: "created" },
        { status: "not-sent", miss: "failed" },
        { status: "wallet" },
      ])
    ).toEqual({ outcome: "partial", copies: { confirmed: 1, confirming: 1 } });
  });
});

describe("pool and batch endings", () => {
  const run = (failure: PoolSetupOutcome["failure"], error: unknown = null): PoolSetupOutcome => ({
    status: failure ? "failed" : "complete",
    landed: [],
    failedStep: null,
    failure,
    error,
    cycleId: null,
  });

  it.each([
    [run(null), "confirmed"],
    [run("seed-unconfirmed"), "confirming"],
    [run("not-confirmed"), "confirming"],
    [run("send-failed", new ReceiptWaitLimitError(120_000)), "confirming"],
    [run("send-failed", userRejected), "cancelled"],
    [run("send-failed", new Error("execution reverted")), "failed"],
    [run("pool-paused"), "failed"],
  ])("reads a setup run that ended %# as %s", (outcome, expected) => {
    expect(poolSetupActEnding(outcome).outcome).toBe(expected);
  });

  it.each([
    [{ status: "saved" }, "confirmed"],
    [{ status: "unknown" }, "confirming"],
    [{ status: "not-saved" }, "failed"],
    [{ status: "not-saved", declined: true }, "cancelled"],
    [{ status: "not-batchable" }, { outcome: "failed", parsedErrorFamily: "NotBatchable" }],
  ] as const)("reads a batched save %j as %j", (outcome, expected) => {
    expect(batchSaveActOutcome(outcome)).toEqual(expected);
  });

  it("reads issuer sends and voucher awards that may still land as confirming", () => {
    expect(issuerActOutcome({ status: "reverted" })).toBe("failed");
    expect(issuerActOutcome({ status: "pending", pending: {} as never })).toBe("confirming");
    expect(voucherAwardActOutcome({ record: { state: "confirmed" } })).toBe("confirmed");
    expect(voucherAwardActOutcome({ record: { state: "awaiting_authorization" } })).toBe(
      "confirming"
    );
    expect(voucherAwardActOutcome({ record: { state: "failed" } })).toBe("failed");
    expect(
      voucherAwardActOutcome({
        record: { state: "awaiting_authorization" },
        operation: { status: "declined" },
      })
    ).toBe("cancelled");
    // A retry of a failed award whose new execution has no receipt yet may still land.
    expect(
      voucherAwardActOutcome({ record: { state: "failed" }, operation: { status: "submitted" } })
    ).toBe("confirming");
  });

  it("classifies a thrown error the same way for every caller", () => {
    expect(sendActEnding(userRejected).outcome).toBe("cancelled");
    expect(sendActEnding(new ReceiptWaitLimitError(1)).outcome).toBe("confirming");
    // Refused before sending: the earlier send holding the same thing keeps its own record.
    expect(sendActEnding(new Error("batch-items-held"))).toEqual({
      outcome: "failed",
      parsedErrorFamily: "HeldByAnotherSend",
    });
  });
});

/**
 * The source contract: a Shared hook that calls a send or signature primitive
 * records its act, or is named here with where its record lives instead. The
 * list may only shrink.
 */
const RECORDED_ELSEWHERE: Record<string, string> = {
  "agent-reporting/useAgentReportingPermissions.ts": "the bot's records belong to PRD-1508",
  "agent-reporting/useCeremonyAccount.ts": "the bot's records belong to PRD-1508",
  "blockchain/useContractTxSender.ts": "the primitive itself; its callers record the act",
  "blockchain/useTransactionSender.ts": "the primitive itself; its callers record the act",
  "garden/createGardenOperation.ts": "member changes record admin_member_*",
  "garden/useGardenJoinRequests.ts": "signs an API session, not a send; garden_join_request_*",
  "yield/useHarvestDistribution.ts": "records admin_harvest_distribution_*",
  // Not yet recorded: hypercert listings, Karma, deployments and profile signatures.
  "blockchain/useDeploymentRegistry.ts": "follow-up",
  "garden/useKarmaIntegration.ts": "follow-up",
  "gardener/useGardenerProfile.ts": "follow-up",
  "hypercerts/useBatchListForYield.ts": "follow-up",
  "hypercerts/useMarketplaceApprovals.ts": "follow-up",
  "profile/useProfileAvatar.ts": "follow-up",
};

const SEND_PRIMITIVE =
  /\.sendContractCall\(|\.sendAtomicBatch|\.submitAtomicBatch\(|\.signTypedData\(|writeContractAsync\(|sendContractTx\(|\.sendTransaction\(|signMessageAsync\(|signMessage: signMessageAsync/;
const RECORDS_ACT = /\brecordSendAct\b|\brecordedSendAct\b|\brecordedSetupRun\b/;

function hookSources(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) return hookSources(path);
    return /\.tsx?$/.test(entry.name) && !/\.(test|stories)\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("every Shared hook that signs or sends", () => {
  it("records its act, or names where its record lives", () => {
    const root = resolve(process.cwd(), "src/hooks");
    const unrecorded = hookSources(root)
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        return SEND_PRIMITIVE.test(source) && !RECORDS_ACT.test(source);
      })
      .map((path) => relative(root, path))
      .sort();

    expect(unrecorded).toEqual(Object.keys(RECORDED_ELSEWHERE).sort());
  });
});
