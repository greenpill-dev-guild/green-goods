import { act, waitFor } from "@testing-library/react";
import { encodeFunctionData } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildReportingProofMessage } from "../../../modules/agent-reporting/proof";
import type { ContractCall, TransactionSender } from "../../../modules/transactions/types";
import { renderHookWithProviders } from "../../test-utils";
import { ACCOUNT, FakeAgent, OTHER_ACCOUNT, TX_HASH, workEnvelope } from "./fake-agent";

const mocks = vi.hoisted(() => ({
  account: "0x00000000000000000000000000000000000000a1" as `0x${string}`,
  signMessage: vi.fn(async (_args: { message: string }) => `0x${"11".repeat(65)}` as `0x${string}`),
  sender: null as TransactionSender | null,
}));

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
  window.sessionStorage.clear();
});

afterEach(() => {
  window.sessionStorage.clear();
});

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
});
