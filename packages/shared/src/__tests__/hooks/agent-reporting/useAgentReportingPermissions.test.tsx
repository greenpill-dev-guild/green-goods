import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PermissionReader } from "../../../modules/agent-reporting/permission-management";
import { permissionStorageKey } from "../../../modules/agent-reporting/permission-management";
import type { TransactionSender } from "../../../modules/transactions/types";
import { renderHookWithProviders } from "../../test-utils/render-helpers";

const ACCOUNT = "0x00000000000000000000000000000000000000a1";
const ID = "0x12345678";
const HASH = `0x${"ab".repeat(32)}` as const;
const mocks = vi.hoisted(() => ({ sender: null as TransactionSender | null }));
vi.mock("../../../hooks/agent-reporting/useCeremonyAccount", () => ({
  useCeremonyAccount: () => ({ account: ACCOUNT }),
}));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => mocks.sender,
}));
import { useAgentReportingPermissions } from "../../../hooks/agent-reporting/useAgentReportingPermissions";

function chain() {
  const state = { current: 3, validFrom: 2, nonce: 2 };
  const reader: PermissionReader = {
    assertKernel: vi.fn(async () => {}),
    generations: async () => ({ current: state.current, validFrom: state.validFrom }),
    discover: async () => [ID],
    permission: async (_account, permissionId) => ({
      permissionId,
      signerAddress: ACCOUNT,
      nonce: state.nonce,
      active: state.nonce >= state.validFrom,
    }),
  };
  return { state, reader };
}
function sender(send: TransactionSender["sendContractCall"]) {
  mocks.sender = {
    authMode: "passkey",
    supportsBatching: false,
    supportsSponsorship: true,
    sendContractCall: vi.fn(send),
  };
}
beforeEach(() => {
  window.localStorage.clear();
  mocks.sender = null;
});

describe("Agent-independent owner permission management", () => {
  it("inspects direct-chain authority without asking the owner to sign", async () => {
    const { reader } = chain();
    sender(async () => {
      throw new Error("must not sign while inspecting");
    });
    const { result } = renderHookWithProviders(() => useAgentReportingPermissions({ reader }));
    expect(result.current.stage).toBe("idle");
    await act(() => result.current.scan());
    expect(result.current).toMatchObject({
      stage: "ready",
      permissions: [{ permissionId: ID, active: true }],
    });
    expect(mocks.sender!.sendContractCall).not.toHaveBeenCalled();
  });
  it("derives an owner invalidation, saves fallback hash, and confirms actual chain generations", async () => {
    const { state, reader } = chain();
    sender(async (call, options) => {
      expect(call).toMatchObject({
        address: ACCOUNT,
        account: ACCOUNT,
        chainId: 42161,
        functionName: "invalidateNonce",
        args: [4],
        value: 0n,
      });
      await options?.onBeforeBroadcast?.();
      expect(
        JSON.parse(localStorage.getItem(permissionStorageKey(ACCOUNT))!).pendingGeneration
      ).toBe(4);
      state.current = state.validFrom = 4;
      return { hash: HASH, sponsored: true };
    });
    const { result } = renderHookWithProviders(() => useAgentReportingPermissions({ reader }));
    await act(() => result.current.revoke());
    expect(result.current).toMatchObject({
      stage: "revoked",
      transactionHash: HASH,
      permissions: [{ active: false }],
    });
    expect(
      JSON.parse(localStorage.getItem(permissionStorageKey(ACCOUNT))!).pendingGeneration
    ).toBeUndefined();
  });
  it("shows surviving concurrent owner installations instead of claiming every permission is revoked", async () => {
    const { state, reader } = chain();
    sender(async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      state.current = state.validFrom = state.nonce = 4;
      return { hash: HASH, sponsored: true };
    });
    const { result } = renderHookWithProviders(() => useAgentReportingPermissions({ reader }));
    await act(() => result.current.revoke());
    expect(result.current).toMatchObject({
      stage: "ready",
      error: "remaining_permissions",
      permissions: [{ active: true }],
    });
  });
  it("retains an uncertain generation and first reference across reloads and rejects duplicate sends", async () => {
    const { state, reader } = chain();
    sender(async (_call, options) => {
      await options?.onBeforeBroadcast?.({ kind: "user-operation", hash: HASH });
      throw new Error("bundler response lost");
    });
    const first = renderHookWithProviders(() => useAgentReportingPermissions({ reader }));
    await act(() => first.result.current.revoke());
    expect(first.result.current.stage).toBe("submitted");
    first.unmount();
    const { result } = renderHookWithProviders(() => useAgentReportingPermissions({ reader }));
    expect(result.current).toMatchObject({ stage: "submitted", transactionHash: HASH });
    await act(() => result.current.revoke());
    expect(mocks.sender!.sendContractCall).toHaveBeenCalledTimes(1);
    state.current = state.validFrom = 4;
    await act(() => result.current.scan());
    expect(result.current.stage).toBe("revoked");
  });
});
