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
  ownerClient: {
    chain: { id: 42161 },
    account: { address: "0x00000000000000000000000000000000000000a1" },
  },
  sendActivation: vi.fn(),
  signOut: vi.fn(async () => {}),
  loginWithPasskey: vi.fn(async (_name?: string) => {}),
  trackError: vi.fn(),
  offer: vi.fn(
    async (_account: string): Promise<{ address: string; name: string; chainId: number } | null> =>
      null
  ),
}));

/** The garden an account not yet in it is invited to; by default the account needs no invitation. */
const OFFER = {
  address: "0x00000000000000000000000000000000000000c9",
  name: "Community Garden",
  chainId: 42161,
};

vi.mock("../../../hooks/agent-reporting/community-offer", () => ({
  readCommunityOffer: (account: string) => mocks.offer(account),
}));
vi.mock("../../../modules/agent-reporting/browser-grant-activation", () => ({
  sendBrowserGrantActivation: mocks.sendActivation,
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
    smartAccountClient: mocks.ownerClient,
    isAuthenticating: false,
  }),
  useAuthActions: () => ({
    loginWithWallet: vi.fn(),
    loginWithPasskey: mocks.loginWithPasskey,
    signOut: mocks.signOut,
  }),
}));
vi.mock("../../../modules/app/error-categories", () => ({
  trackError: mocks.trackError,
  trackAuthError: mocks.trackError,
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
  mocks.signOut.mockClear();
  mocks.loginWithPasskey.mockClear();
  mocks.trackError.mockClear();
  mocks.offer.mockReset();
  mocks.offer.mockResolvedValue(null);
  mocks.sendActivation.mockReset();
  mocks.sendActivation.mockImplementation(async (input) => {
    input.assertOwner();
    await input.signDelegate({
      sender: ACCOUNT,
      nonce: "0x0",
      callData: "0x1234",
      callGasLimit: "0x1",
      verificationGasLimit: "0x1",
      preVerificationGas: "0x1",
      maxFeePerGas: "0x1",
      maxPriorityFeePerGas: "0x0",
      paymaster: ACCOUNT,
      paymasterVerificationGasLimit: "0x1",
      paymasterPostOpGasLimit: "0x0",
      paymasterData: "0xab",
    });
    input.onBeforeBroadcast(TX_HASH);
    return TX_HASH;
  });
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

  it("settles the garden invitation for the proven account before the code screen opens", async () => {
    agent.purpose = "link_account";
    agent.boundAccount = null;
    mocks.offer.mockResolvedValue(OFFER);
    const calls = wallet("send");
    const { result } = render();
    await act(() => result.current.start());
    await act(() => result.current.prove());
    expect(mocks.offer).toHaveBeenCalledWith(ACCOUNT);
    expect(result.current).toMatchObject({
      stage: "pairing",
      linkedAccount: ACCOUNT,
      communityOffer: OFFER,
    });

    await act(() => result.current.joinCommunity());
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      address: OFFER.address,
      account: ACCOUNT,
      functionName: "joinGarden",
    });
    // Sent once: the invitation is gone, and it stays gone when the chat confirms the code.
    expect(result.current.communityOffer).toBeNull();
    agent.challengeState = "paired";
    await waitFor(() => expect(result.current.stage).toBe("linked"));
    expect(result.current.communityOffer).toBeNull();
    expect(mocks.offer).toHaveBeenCalledTimes(1);
  });

  it("invites a linked chat's account in a browser the Agent recognized, and joins as no other", async () => {
    agent.purpose = "link_account";
    agent.challengeState = "paired";
    agent.verifiedAccount = ACCOUNT;
    mocks.offer.mockResolvedValue(OFFER);
    // The wallet in this browser has moved on to another account since the proof.
    mocks.account = OTHER_ACCOUNT;
    const calls = wallet("send");
    const { result } = render();
    await act(() => result.current.start());
    expect(result.current).toMatchObject({
      stage: "linked",
      linkedAccount: ACCOUNT,
      communityOffer: OFFER,
    });
    await act(() => result.current.joinCommunity());
    expect(calls).toEqual([]);
  });

  it("lets go of the connected account, and retires a code shown for it", async () => {
    agent.purpose = "link_account";
    agent.boundAccount = null;
    const { result } = render();
    await act(() => result.current.start());
    // On the account step only the website's sign-in changes; the challenge is still unused.
    await act(() => result.current.changeAccount());
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(result.current.stage).toBe("connect");

    await act(() => result.current.prove());
    expect(result.current.pairingCode).toBe("481516");
    // The code belongs to the account that proved it. Another account starts the link over.
    await act(() => result.current.changeAccount());
    expect(result.current.stage).toBe("intro");
    expect(result.current.pairingCode).toBeNull();
    expect(result.current.linkedAccount).toBeNull();
    await act(() => result.current.start());
    const opened = agent.calls.filter(
      (call) => call.method === "POST" && call.path === "/challenges"
    );
    expect(opened).toHaveLength(2);
  });

  it("returns to its account step when the app remounts for the account it was changed to", async () => {
    agent.purpose = "link_account";
    agent.boundAccount = null;
    const first = render();
    await act(() => first.result.current.start());
    await act(() => first.result.current.changeAccount());
    // A different account signing in remounts every screen, this page included.
    first.unmount();
    const { result } = render();
    await waitFor(() => expect(result.current.stage).toBe("connect"));
    const opened = () =>
      agent.calls.filter((call) => call.method === "POST" && call.path === "/challenges");
    expect(opened()).toHaveLength(2);
    // The marker is spent: a later reload waits for Continue like any link opened fresh.
    result.current.leave();
    const later = render();
    await act(async () => {});
    expect(later.result.current.stage).toBe("intro");
    expect(opened()).toHaveLength(2);
  });

  it("finds a passkey account by the name it was created with", async () => {
    const { result } = render();
    await act(() => result.current.connectPasskey("afo.eth"));
    expect(mocks.loginWithPasskey).toHaveBeenCalledWith("afo.eth");
  });

  it("records the error behind a failure it can only call unknown", async () => {
    const stale = new Error("Connector not connected.");
    mocks.signMessage.mockRejectedValueOnce(stale);
    const { result } = render();
    await act(() => result.current.start());
    await act(() => result.current.prove());
    expect(result.current.stage).toBe("connect");
    expect(result.current.error).toBe("unknown");
    expect(mocks.trackError).toHaveBeenCalledWith(
      stale,
      expect.objectContaining({ source: "useAgentReportingCeremony" })
    );
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

  it("keeps checking a send it can't confirm and shows the chain's answer once it settles", async () => {
    mocks.sender = {
      authMode: "wallet",
      supportsSponsorship: false,
      supportsBatching: false,
      async sendContractCall(_call, options) {
        await options?.onBeforeBroadcast?.();
        throw new Error("The wallet stopped responding.");
      },
    };
    const { result } = render();
    await reachReview(result);
    await act(() => result.current.publish());
    expect(result.current.stage).toBe("submitted");
    expect(result.current.error).toBe("outcome_unknown");
    const checks = agent.requests("GET", "/operations/op-1").length;
    await waitFor(() =>
      expect(agent.requests("GET", "/operations/op-1").length).toBeGreaterThan(checks)
    );
    expect(result.current.error).toBe("outcome_unknown");

    agent.operation = { ...agent.operation, state: "published", transactionHash: TX_HASH };
    await waitFor(() => expect(result.current.stage).toBe("published"));
    expect(result.current.error).toBeNull();
    expect(agent.requests("POST", "/operations/op-1/attempts")).toHaveLength(1);
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

  it("prepares the first report without signing, then reserves before the owner enables and publishes", async () => {
    wallet("send");
    const { result } = render();
    await reachGrant(result);
    expect(agent.requests("POST", "/execution-grants/g-1/activation")).toEqual([]);
    await act(() => result.current.installGrant());
    expect(result.current.resource?.title).toBe("Planted seedlings");
    expect(mocks.sendActivation).not.toHaveBeenCalled();
    await act(() => result.current.installGrant());
    expect(mocks.sendActivation).toHaveBeenCalledTimes(1);
    expect(agent.requests("POST", "/execution-grants/g-1/activation").map((r) => r.path)).toEqual([
      "/execution-grants/g-1/activation",
      "/execution-grants/g-1/activation/attempts",
      "/execution-grants/g-1/activation/signature",
      "/execution-grants/g-1/activation/outcome",
    ]);
    expect(agent.requests("POST", "/execution-grants/g-1/approval")).toEqual([]);
    expect(result.current.stage).toBe("grant_submitted");
    const saved = window.localStorage.getItem("gg-reporting-permissions");
    expect(saved ?? "").not.toContain("signature");
  });

  it("polls a first report whose operation is not ready without creating or signing another one", async () => {
    wallet("send");
    agent.activationEmpty = true;
    const { result } = render();
    await reachGrant(result);
    await act(() => result.current.installGrant());
    await waitFor(() => expect(result.current.stage).toBe("loading"));
    expect(result.current.operation).toBeNull();
    expect(mocks.sendActivation).not.toHaveBeenCalled();
    agent.activationEmpty = false;
    await waitFor(() => expect(result.current.stage).toBe("grant_ready"));
    expect(result.current.resource?.title).toBe("Planted seedlings");
    expect(agent.requests("POST", "/execution-grants/g-1/activation")).toHaveLength(1);
    expect(mocks.sendActivation).not.toHaveBeenCalled();
  });

  it("replays the public activation reference after a dropped API reply without signing again", async () => {
    wallet("send");
    const first = render();
    await reachGrant(first.result);
    await act(() => first.result.current.installGrant());
    agent.dropOutcomes = 2;
    await act(() => first.result.current.installGrant());
    expect(
      readCeremony("request-0123456789abcdef")?.pendingGrantActivation?.request.outcome
    ).toEqual({ kind: "uncertain", reason: "send_unknown", userOperationHash: TX_HASH });
    first.unmount();
    const { result } = render();
    await waitFor(() => expect(result.current.stage).toBe("grant_submitted"));
    await act(() => result.current.installGrant());
    expect(mocks.sendActivation).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe("outcome_unknown");
    expect(
      agent.requests("POST", "/execution-grants/g-1/activation/outcome").at(-1)?.body
    ).toMatchObject({ idempotencyKey: "at-1:uncertain", outcome: { userOperationHash: TX_HASH } });
  });

  it("reports an owner decline before delegate signing and closes the grant", async () => {
    wallet("send");
    mocks.sendActivation.mockRejectedValue(
      Object.assign(new Error("User rejected the request."), { code: 4001 })
    );
    const { result } = render();
    await reachGrant(result);
    await act(() => result.current.installGrant());
    await act(() => result.current.installGrant());
    expect(result.current).toMatchObject({ stage: "failed", error: "declined" });
    expect(agent.requests("POST", "/execution-grants/g-1/activation/signature")).toEqual([]);
    expect(
      agent.requests("POST", "/execution-grants/g-1/activation/outcome")[0]?.body?.outcome
    ).toEqual({ kind: "rejected_before_send", reason: "user_rejected" });
  });

  it("settles a refused Agent signature before broadcast so the report can return to its owner", async () => {
    wallet("send");
    agent.activationSignatureFailure = true;
    const { result } = render();
    await reachGrant(result);
    await act(() => result.current.installGrant());
    await act(() => result.current.installGrant());
    expect(agent.requests("POST", "/execution-grants/g-1/activation/signature")).toHaveLength(1);
    expect(
      agent.requests("POST", "/execution-grants/g-1/activation/outcome")[0]?.body?.outcome
    ).toEqual({ kind: "preparation_failed", reason: "activation_unavailable" });
    expect(result.current.error).toBe("unsupported");
    expect(result.current.stage).toBe("failed");
    expect(readCeremony("request-0123456789abcdef")?.pendingGrantActivation).toBeUndefined();
  });

  it("keeps a delegate signature with no bundler result uncertain and blocks a second owner prompt", async () => {
    wallet("send");
    const send = mocks.sendActivation.getMockImplementation()!;
    mocks.sendActivation.mockImplementation(async (input) => {
      await send(input);
      throw new Error("Connection lost");
    });
    const { result } = render();
    await reachGrant(result);
    await act(() => result.current.installGrant());
    await act(() => result.current.installGrant());
    await act(() => result.current.installGrant());
    expect(result.current).toMatchObject({ stage: "grant_submitted", error: "outcome_unknown" });
    expect(mocks.sendActivation).toHaveBeenCalledTimes(1);
    expect(readCeremony("request-0123456789abcdef")?.pendingGrantActivation).toBeDefined();
  });

  it("rejects an account or module substituted in the recovery descriptor before asking the owner", async () => {
    const calls = wallet("send");
    const { result } = render();
    agent.grant = grantFixture();
    agent.grant.revocationDescriptor!.account = OTHER_ACCOUNT;
    await reachGrant(result);
    await act(() => result.current.installGrant());
    expect(result.current.error).toBe("envelope_mismatch");
    expect(mocks.sendActivation).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it("ends installation polling when chain reconciliation reports a paused grant", async () => {
    wallet("send");
    const { result } = render();
    await reachGrant(result);
    await act(() => result.current.installGrant());
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
