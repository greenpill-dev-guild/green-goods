import { act, waitFor } from "@testing-library/react";
import { encodeFunctionData } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildReportingProofMessage } from "../../../modules/agent-reporting/proof";
import { grantPolicyDigest } from "../../../modules/agent-reporting/grants";
import type { GrantView } from "../../../modules/agent-reporting/api-contract";
import { readCeremony, writeCeremony } from "../../../hooks/agent-reporting/ceremony-storage";
import { resumeGrantInstallation } from "../../../hooks/agent-reporting/useGrantInstallation";
import type { ContractCall, TransactionSender } from "../../../modules/transactions/types";
import { renderHookWithProviders } from "../../test-utils/render-helpers";
import { ACCOUNT, FakeAgent, OTHER_ACCOUNT, TX_HASH, workEnvelope } from "./fake-agent";

const mocks = vi.hoisted(() => ({
  account: "0x00000000000000000000000000000000000000a1" as `0x${string}`,
  signMessage: vi.fn(async (_args: { message: string }) => `0x${"11".repeat(65)}` as `0x${string}`),
  sender: null as TransactionSender | null,
  installCall: vi.fn(async () => ({
    address: "0x00000000000000000000000000000000000000a1",
    abi: [],
    functionName: "installValidations",
    args: [],
    value: 0n,
  })),
}));

vi.mock("../../../modules/agent-reporting/kernel-permissions", () => ({
  grantInstallCall: mocks.installCall,
}));
vi.mock("../../../modules/agent-reporting/grants", async (load) => {
  const original = await load<typeof import("../../../modules/agent-reporting/grants")>();
  return {
    ...original,
    revocationDescriptorIssues: (descriptor: unknown) =>
      original.revocationDescriptorIssues(descriptor, [
        {
          moduleRef: "fixture-module",
          chainId: 42161,
          validatorAddress: "0x00000000000000000000000000000000000000d1",
          validatorCodeHash: `0x${"aa".repeat(32)}`,
        },
      ]),
  };
});

vi.mock("wagmi", () => ({ useSignMessage: () => ({ signMessageAsync: mocks.signMessage }) }));
vi.mock("../../../providers/Auth", () => ({
  useAuthState: () => ({
    authMode: "wallet",
    walletAddress: mocks.account,
    smartAccountAddress: null,
    embeddedAddress: null,
    smartAccountClient: null,
    isAuthenticating: false,
  }),
  useAuthActions: () => ({ loginWithWallet: vi.fn(), loginWithPasskey: vi.fn(async () => {}) }),
}));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => mocks.sender,
}));

import { useAgentReportingCeremony } from "../../../hooks/agent-reporting/useAgentReportingCeremony";

/** A wallet that asks the person and then broadcasts in one step, or is declined. */
function wallet(answer: "send" | "decline") {
  const calls: ContractCall[] = [];
  const sender: TransactionSender = {
    authMode: "wallet",
    supportsSponsorship: false,
    supportsBatching: false,
    async sendContractCall(call, options) {
      calls.push(call);
      await options?.onBeforeBroadcast?.();
      if (answer === "decline") {
        throw Object.assign(new Error("User rejected the request."), { code: 4001 });
      }
      await options?.onBroadcastReference?.({ kind: "transaction", hash: TX_HASH });
      return { hash: TX_HASH, sponsored: false };
    },
  };
  mocks.sender = sender;
  return calls;
}

let agent: FakeAgent;

function render() {
  return renderHookWithProviders(() =>
    useAgentReportingCeremony("request-0123456789abcdef", { client: agent.client(), pollMs: 10 })
  );
}

async function reachReview(result: ReturnType<typeof render>["result"]) {
  await act(() => result.current.start());
  await act(() => result.current.prove());
  await waitFor(() => expect(result.current.stage).toBe("review"));
}

beforeEach(() => {
  agent = new FakeAgent();
  mocks.account = ACCOUNT;
  mocks.sender = null;
  mocks.signMessage.mockClear();
  mocks.installCall.mockClear();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

function grantFixture(): GrantView {
  const policy: GrantView["policy"] = {
    version: 1,
    purpose: "reporting",
    chainId: 42161,
    account: ACCOUNT,
    gardenAddress: "0x00000000000000000000000000000000000000c2",
    easAddress: "0x00000000000000000000000000000000000000e1",
    schemaUID: `0x${"ab".repeat(32)}`,
    signerAddress: "0x00000000000000000000000000000000000000f1",
    moduleRef: "fixture-module",
    validAfter: 1_800_000_000_000,
    validUntil: 1_800_086_400_000,
    maxSubmissions: 5,
    gasCap: 500_000,
  };
  const policyDigest = grantPolicyDigest(policy);
  return {
    grantId: "g-1",
    gardenLabel: "Aiyeloja family garden",
    purpose: "reporting",
    state: "owner_authorization_pending",
    version: 1,
    policy,
    policyDigest,
    permissionId: "0x12345678",
    submissionsUsed: 0,
    revocationDescriptor: {
      version: 1,
      chainId: 42161,
      account: ACCOUNT,
      kernelVersion: "0.3.1",
      entryPointVersion: "0.7",
      moduleRef: "fixture-module",
      validatorAddress: "0x00000000000000000000000000000000000000d1",
      validatorCodeHash: `0x${"aa".repeat(32)}`,
      permissionId: "0x12345678",
      signerAddress: policy.signerAddress,
      purpose: "reporting",
      gardenAddress: policy.gardenAddress,
      validUntil: policy.validUntil,
      policyDigest,
    },
  };
}

async function reachGrant(result: ReturnType<typeof render>["result"]) {
  agent.purpose = "grant_reporting";
  agent.grant ??= grantFixture();
  await act(() => result.current.start());
  await act(() => result.current.prove());
  await waitFor(() => expect(result.current.stage).toBe("grant_ready"));
}

/** @direct-test-subject ../../../hooks/agent-reporting/useAgentReportingCeremony.ts
 * @direct-test-subject ../../../hooks/agent-reporting/useGrantInstallation.ts */
describe("reporting ceremony page", () => {
  it("asks for nothing until the person continues, then signs the Agent's exact proof message", async () => {
    const { result } = render();
    expect(result.current.stage).toBe("intro");
    expect(agent.calls).toEqual([]);

    await act(() => result.current.start());
    expect(agent.calls[0]).toMatchObject({ method: "POST", path: "/challenges" });
    expect(agent.calls[0]?.headers["x-gg-bootstrap"]).toBe("1");
    expect(result.current.stage).toBe("connect");

    await act(() => result.current.prove());
    const proof = (await agent.client().challenge("ch-1")).proof;
    expect(mocks.signMessage).toHaveBeenCalledWith({
      message: buildReportingProofMessage(proof, ACCOUNT),
    });
    await waitFor(() => expect(result.current.stage).toBe("review"));
    expect(result.current.resource?.title).toBe("Planted seedlings");
    expect(result.current.issues).toEqual([]);
  });

  it("shows a pairing code for a new link and finishes once the chat confirms it", async () => {
    agent.purpose = "link_account";
    agent.boundAccount = null;
    const { result } = render();
    await act(() => result.current.start());
    await act(() => result.current.prove());
    expect(result.current.stage).toBe("pairing");
    expect(result.current.pairingCode).toBe("481516");

    agent.challengeState = "paired";
    await waitFor(() => expect(result.current.stage).toBe("linked"));
    expect(agent.requests("POST", "/access")).toEqual([]);
  });

  it("keeps a proof from another account retryable instead of ending the page", async () => {
    mocks.account = OTHER_ACCOUNT;
    const { result } = render();
    await act(() => result.current.start());
    await act(() => result.current.prove());
    expect(result.current.stage).toBe("connect");
    expect(result.current.error).toBe("wrong_account");
  });

  it("sends exactly the frozen attestation, reports its hash once, and follows it to publication", async () => {
    const calls = wallet("send");
    const { result } = render();
    await reachReview(result);
    await act(() => result.current.publish());

    const envelope = workEnvelope();
    expect(calls).toHaveLength(1);
    const [call] = calls as [ContractCall];
    expect(call.address).toBe(envelope.call.to);
    expect(call.value).toBe(0n);
    expect(
      encodeFunctionData({ abi: call.abi, functionName: call.functionName, args: call.args })
    ).toBe(envelope.call.data);
    const outcomes = agent.requests("POST", "/operations/op-1/outcome");
    expect(outcomes.map((request) => request.body?.outcome)).toEqual([
      { kind: "broadcast", transactionHash: TX_HASH },
    ]);
    expect(result.current.stage).toBe("submitted");

    agent.operation = { ...agent.operation, state: "published", transactionHash: TX_HASH };
    await waitFor(() => expect(result.current.stage).toBe("published"));
  });

  it("reports a declined wallet prompt as not sent", async () => {
    wallet("decline");
    const { result } = render();
    await reachReview(result);
    await act(() => result.current.publish());
    expect(agent.requests("POST", "/operations/op-1/outcome")[0]?.body?.outcome).toEqual({
      kind: "rejected_before_send",
      reason: "user_rejected",
    });
    expect(result.current.stage).toBe("not_sent");
  });

  it("refuses an envelope that no longer matches its own digest before reserving anything", async () => {
    const calls = wallet("send");
    const envelope = workEnvelope();
    if (envelope.kind !== "work") throw new Error("Expected a work envelope");
    agent.operation = {
      ...agent.operation,
      envelope: { ...envelope, fields: { ...envelope.fields, title: "Something else" } },
    };
    const { result } = render();
    await reachReview(result);
    expect(result.current.issues).toContain("digest_mismatch");
    await act(() => result.current.publish());
    expect(result.current.error).toBe("envelope_mismatch");
    expect(agent.requests("POST", "/operations/op-1/attempts")).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("replays an outcome it could not deliver, with the same key, after a reload", async () => {
    wallet("send");
    agent.dropOutcomes = 2;
    const first = render();
    await reachReview(first.result);
    await act(() => first.result.current.publish());
    expect(first.result.current.stage).toBe("submitted");
    expect(agent.operation.state).toBe("prepared");
    first.unmount();

    const { result } = render();
    await waitFor(() => expect(result.current.stage).toBe("submitted"));
    const outcomes = agent.requests("POST", "/operations/op-1/outcome");
    expect(outcomes).toHaveLength(3);
    expect(outcomes[2]?.body).toEqual(outcomes[0]?.body);
    expect(outcomes[2]?.body).toMatchObject({
      idempotencyKey: "at-1:broadcast",
      outcome: { kind: "broadcast", transactionHash: TX_HASH },
    });
    expect(agent.operation.state).toBe("reconciling");
  });

  it("resumes its own session after a refresh without opening a new challenge", async () => {
    const first = render();
    await reachReview(first.result);
    first.unmount();

    agent.calls.length = 0;
    const { result } = render();
    await waitFor(() => expect(result.current.stage).toBe("review"));
    expect(agent.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "GET /access/current",
      "GET /drafts/d-1",
    ]);
  });

  it("persists a sender result without callback and retries the same installation reference after reload", async () => {
    wallet("send");
    mocks.sender!.sendContractCall = async () => ({ hash: TX_HASH, sponsored: false });
    agent.dropGrantApprovals = 1;
    const first = render();
    await reachGrant(first.result);
    await act(() => first.result.current.installGrant());
    expect(readCeremony("request-0123456789abcdef")?.pendingGrant?.enableReference).toBe(TX_HASH);
    first.unmount();
    const { result } = render();
    await waitFor(() => expect(result.current.stage).toBe("grant_submitted"));
    expect(
      agent.requests("POST", "/execution-grants/g-1/approval").map((r) => r.body?.enableReference)
    ).toEqual([TX_HASH, TX_HASH]);
    expect(readCeremony("request-0123456789abcdef")?.pendingGrant).toBeUndefined();
    expect(mocks.installCall).toHaveBeenCalledTimes(1);
  });

  it("keeps the first UserOperation reference when receipt and API delivery differ", async () => {
    wallet("send");
    const userOperationHash = `0x${"ef".repeat(32)}` as const;
    mocks.sender!.sendContractCall = async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      await options?.onBroadcastReference?.({ kind: "user-operation", hash: userOperationHash });
      return { hash: TX_HASH, sponsored: false };
    };
    agent.dropGrantApprovals = 3;
    const first = render();
    await reachGrant(first.result);
    await act(() => first.result.current.installGrant());
    first.unmount();
    expect(
      await resumeGrantInstallation(
        agent.client(),
        "request-0123456789abcdef",
        readCeremony("request-0123456789abcdef")!
      )
    ).toMatchObject({ stage: "grant_submitted", error: "outcome_unknown" });
    agent.dropGrantApprovals = 1;
    const { result } = render();
    await waitFor(() => expect(result.current.error).toBe("outcome_unknown"));
    expect(readCeremony("request-0123456789abcdef")?.pendingGrant?.enableReference).toBe(
      userOperationHash
    );
    await act(() => result.current.installGrant());
    expect(mocks.installCall).toHaveBeenCalledTimes(1);
    expect(
      agent.requests("POST", "/execution-grants/g-1/approval").map((r) => r.body?.enableReference)
    ).toEqual([userOperationHash, userOperationHash, userOperationHash, userOperationHash]);
  });

  it("rejects an account or module substituted in the recovery descriptor before asking the owner", async () => {
    const calls = wallet("send");
    const { result } = render();
    agent.grant = grantFixture();
    agent.grant.revocationDescriptor!.account = OTHER_ACCOUNT;
    await reachGrant(result);
    await act(() => result.current.installGrant());
    expect(result.current.error).toBe("envelope_mismatch");
    expect(mocks.installCall).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it("ends installation polling when chain reconciliation reports a paused grant", async () => {
    wallet("send");
    const { result } = render();
    await reachGrant(result);
    await act(() => result.current.installGrant());
    agent.grant = { ...agent.grant!, state: "paused" };
    await waitFor(() => expect(result.current.stage).toBe("failed"));
    expect(result.current.error).toBe("paused");
  });
  it.each([
    ["active", "grant_active", null],
    ["paused", "failed", "paused"],
    ["failed", "failed", null],
    ["expired", "unavailable", "expired"],
    ["revoked", "unavailable", "changed"],
  ] as const)("clears undelivered setup uncertainty when the exact grant is authoritatively %s", async (state, stage, error) => {
    const grant = grantFixture();
    agent.grant = { ...grant, state };
    agent.dropGrantApprovals = 1;
    writeCeremony("request-0123456789abcdef", {
      accessId: "acc-1",
      pendingGrant: {
        grantId: grant.grantId,
        version: grant.version,
        policyDigest: grant.policyDigest,
        enableReference: TX_HASH,
      },
    });
    expect(
      await resumeGrantInstallation(
        agent.client(),
        "request-0123456789abcdef",
        readCeremony("request-0123456789abcdef")!
      )
    ).toMatchObject({ stage, error });
    expect(readCeremony("request-0123456789abcdef")?.pendingGrant).toBeUndefined();
  });
  it("never offers an expired proposal to the owner's wallet", async () => {
    const calls = wallet("send");
    agent.grant = grantFixture();
    agent.grant.policy.validAfter = 1;
    agent.grant.policy.validUntil = 2;
    const { result } = render();
    await reachGrant(result);
    await act(() => result.current.installGrant());
    expect(result.current).toMatchObject({ stage: "unavailable", error: "expired" });
    expect(calls).toEqual([]);
  });
});
