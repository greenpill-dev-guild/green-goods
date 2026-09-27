import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../../test-utils";
import { ACCOUNT, FakeAgent } from "./fake-agent";

vi.mock("wagmi", () => ({
  useSignMessage: () => ({ signMessageAsync: vi.fn(async () => `0x${"11".repeat(65)}`) }),
}));
vi.mock("../../../providers/Auth", () => ({
  useAuthState: () => ({
    authMode: "wallet",
    walletAddress: "0x00000000000000000000000000000000000000a1",
    smartAccountAddress: null,
    embeddedAddress: null,
    smartAccountClient: null,
    isAuthenticating: false,
  }),
  useAuthActions: () => ({ loginWithWallet: vi.fn(), loginWithPasskey: vi.fn(async () => {}) }),
}));

import { useAgentReportingRecovery } from "../../../hooks/agent-reporting/useAgentReportingRecovery";

let agent: FakeAgent;

beforeEach(() => {
  agent = new FakeAgent();
  agent.purpose = "recovery";
});

describe("account recovery page", () => {
  it("moves the account only after the proof, the chat's code and an explicit confirmation", async () => {
    const { result } = renderHookWithProviders(() =>
      useAgentReportingRecovery("request-0123456789abcdef", { client: agent.client() })
    );
    await act(() => result.current.start());
    expect(result.current.stage).toBe("connect");

    await act(() => result.current.prove());
    expect(result.current.stage).toBe("code");
    expect(result.current.recoveredAccount).toBe(ACCOUNT);

    await act(() => result.current.confirmCode("000000"));
    expect(result.current).toMatchObject({ stage: "code", error: "wrong_code" });

    await act(() => result.current.confirmCode(" 271828 "));
    expect(result.current.stage).toBe("confirm");
    expect(agent.requests("POST", "/recovery/ch-1/confirm")).toEqual([]);

    await act(() => result.current.apply());
    expect(result.current.stage).toBe("applied");
  });

  it("does not run a recovery ceremony for a link meant for something else", async () => {
    agent.purpose = "publish_work";
    const { result } = renderHookWithProviders(() =>
      useAgentReportingRecovery("request-0123456789abcdef", { client: agent.client() })
    );
    await act(() => result.current.start());
    expect(result.current.stage).toBe("unsupported");
    expect(agent.requests("GET", "/recovery")).toEqual([]);
  });
});
