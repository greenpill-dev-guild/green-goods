/** @vitest-environment happy-dom */
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatHypercertMetadata, TOTAL_UNITS } from "../../../lib/hypercerts";
import { onWalletReconnectAsk } from "../../../modules/auth/wallet-reconnect";
import {
  createMockHypercertAttestation,
  createMockHypercertDraft,
} from "../../test-utils/mock-factories";
import { renderHookWithProviders } from "../../test-utils/render-helpers";

const mocks = vi.hoisted(() => ({
  walletRestore: null as "restoring" | "failed" | null,
  authMode: "wallet" as "wallet" | "passkey",
  eoaAddress: `0x${"1".repeat(40)}`,
  networkContracts: {} as { gardensModule?: string },
  readPool: vi.fn(),
  waitForReceipt: vi.fn(),
  readyWalletClient: vi.fn(),
  register: vi.fn(),
  upload: vi.fn(),
  resolveContracts: vi.fn(),
  mintState: vi.fn(),
  buildAndSign: vi.fn(),
  pollForReceipt: vi.fn(),
}));
vi.mock("../../../hooks/auth/useAuth", () => ({
  useAuth: () => ({
    authMode: mocks.authMode,
    walletRestore: mocks.walletRestore,
    eoaAddress: mocks.eoaAddress,
  }),
}));
vi.mock("../../../stores/useAdminStore", () => ({
  useAdminStore: (select: (state: { selectedChainId: number }) => unknown) =>
    select({ selectedChainId: 42161 }),
}));
vi.mock("../../../stores/useHypercertWizardStore", () => ({
  useHypercertWizardStore: (
    select: (state: { setMintingState: typeof mocks.mintState }) => unknown
  ) => select({ setMintingState: mocks.mintState }),
}));
vi.mock("../../../modules/data/ipfs/client", () => ({
  getIpfsInitStatus: () => ({ clientReady: true }),
}));
vi.mock("../../../modules/data/ipfs/upload", () => ({
  uploadJSONToIPFS: (...args: unknown[]) => mocks.upload(...args),
}));
vi.mock("../../../hooks/hypercerts/hypercert-contracts", () => ({
  resolveHypercertContracts: (...args: unknown[]) => mocks.resolveContracts(...args),
}));
vi.mock("../../../utils/blockchain/contracts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../utils/blockchain/contracts")>()),
  getNetworkContracts: () => mocks.networkContracts,
}));
vi.mock("../../../config/pimlico", () => ({
  createPublicClientForChain: () => ({
    readContract: mocks.readPool,
    waitForTransactionReceipt: mocks.waitForReceipt,
  }),
}));
vi.mock("../../../modules/transactions/chain-guard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../modules/transactions/chain-guard")>()),
  readyWalletClient: mocks.readyWalletClient,
}));
vi.mock("../../../hooks/hypercerts/services/build-and-sign", async () => {
  const { fromPromise } = await import("xstate");
  return { createBuildAndSignActor: () => fromPromise(mocks.buildAndSign) };
});
vi.mock("../../../hooks/hypercerts/services/poll-for-receipt", async () => {
  const { fromPromise } = await import("xstate");
  return { createPollForReceiptActor: () => fromPromise(mocks.pollForReceipt) };
});

import { useMintHypercert } from "../../../hooks/hypercerts/useMintHypercert";

function input() {
  const draft = createMockHypercertDraft();
  const allowlist = [{ address: draft.stewardAddress, units: TOTAL_UNITS }];
  const attestations = [createMockHypercertAttestation()];
  const metadata = formatHypercertMetadata({ draft, attestations, allowlist });
  if (!metadata) throw new Error("Invalid hypercert fixture");
  return { draft, allowlist, metadata, attestations };
}

describe("hypercert wallet readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.walletRestore = null;
    mocks.authMode = "wallet";
    mocks.eoaAddress = `0x${"1".repeat(40)}`;
    mocks.networkContracts = {};
    mocks.readPool.mockResolvedValue(`0x${"2".repeat(40)}`);
    mocks.readyWalletClient.mockResolvedValue({ writeContract: mocks.register });
    mocks.register.mockResolvedValue(`0x${"ef".repeat(32)}`);
    mocks.waitForReceipt.mockResolvedValue({ status: "success" });
    mocks.resolveContracts.mockResolvedValue({});
    mocks.upload.mockRejectedValue(new Error("upload unavailable"));
  });

  it.each([
    "restoring",
    "failed",
  ] as const)("asks before mint preparation or uploads while %s", async (restore) => {
    mocks.walletRestore = restore;
    const asked = vi.fn();
    const stop = onWalletReconnectAsk(asked);
    try {
      const { result } = renderHookWithProviders(() => useMintHypercert({ errorMode: "inline" }));
      await act(async () => {
        await expect(result.current.mint(input())).rejects.toMatchObject({
          name: "WalletReconnectRequiredError",
          asked: true,
        });
      });
      expect(asked).toHaveBeenCalledOnce();
      expect(mocks.resolveContracts).not.toHaveBeenCalled();
      expect(mocks.upload).not.toHaveBeenCalled();
      expect(result.current.status).toBe("idle");
    } finally {
      stop();
    }
  });

  it("allows mint preparation after the wallet answers", async () => {
    mocks.walletRestore = "restoring";
    const { result, rerender } = renderHookWithProviders(() =>
      useMintHypercert({ errorMode: "inline" })
    );
    await expect(result.current.mint(input())).rejects.toMatchObject({
      name: "WalletReconnectRequiredError",
    });
    expect(mocks.upload).not.toHaveBeenCalled();
    mocks.walletRestore = null;
    rerender();
    await act(() => result.current.mint(input()));
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce());
  });

  it("does not retry an upload after the wallet stops answering", async () => {
    const { result, rerender } = renderHookWithProviders(() =>
      useMintHypercert({ errorMode: "inline" })
    );
    await act(() => result.current.mint(input()));
    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(mocks.upload).toHaveBeenCalledOnce();
    mocks.walletRestore = "failed";
    rerender();
    const asked = vi.fn();
    const stop = onWalletReconnectAsk(asked);
    try {
      expect(() => result.current.retry()).toThrow("wallet");
      expect(asked).toHaveBeenCalledOnce();
      expect(mocks.upload).toHaveBeenCalledOnce();
    } finally {
      stop();
    }
  });

  it("polls an existing mint after reconnect is lost without another upload or signature", async () => {
    const hash = `0x${"ab".repeat(32)}`;
    const txHash = `0x${"cd".repeat(32)}`;
    mocks.upload.mockResolvedValue({ cid: "bafy-mint" });
    mocks.buildAndSign.mockResolvedValue({ hash });
    mocks.pollForReceipt
      .mockRejectedValueOnce(new Error("Receipt polling timed out"))
      .mockResolvedValueOnce({ txHash, hypercertId: "123" });
    const { result, rerender } = renderHookWithProviders(() =>
      useMintHypercert({ errorMode: "inline" })
    );
    await act(() => result.current.mint(input()));
    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.userOpHash).toBe(hash);
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    mocks.walletRestore = "failed";
    rerender();
    const asked = vi.fn();
    const stop = onWalletReconnectAsk(asked);
    try {
      act(() => result.current.retry());
      await waitFor(() => expect(result.current.status).toBe("confirmed"));
      expect(result.current.userOpHash).toBe(hash);
      expect(result.current.txHash).toBe(txHash);
      expect(result.current.hypercertId).toBe("123");
      expect(mocks.pollForReceipt).toHaveBeenCalledTimes(2);
      expect(mocks.pollForReceipt.mock.calls[1][0].input).toEqual({ hash });
      expect(mocks.upload).toHaveBeenCalledTimes(2);
      expect(mocks.buildAndSign).toHaveBeenCalledOnce();
      expect(asked).not.toHaveBeenCalled();
    } finally {
      stop();
    }
  });

  it("defers a configured pool write after receipt recovery until the original wallet answers", async () => {
    const hash = `0x${"ab".repeat(32)}`;
    const txHash = `0x${"cd".repeat(32)}`;
    mocks.networkContracts = { gardensModule: `0x${"3".repeat(40)}` };
    mocks.upload.mockResolvedValue({ cid: "bafy-mint" });
    mocks.buildAndSign.mockResolvedValue({ hash });
    mocks.pollForReceipt
      .mockRejectedValueOnce(new Error("Receipt polling timed out"))
      .mockResolvedValueOnce({ txHash, hypercertId: "123" });
    const { result, rerender } = renderHookWithProviders(() =>
      useMintHypercert({ errorMode: "inline" })
    );
    await act(() => result.current.mint(input()));
    await waitFor(() => expect(result.current.status).toBe("failed"));
    mocks.walletRestore = "failed";
    rerender();
    const asked = vi.fn();
    const stop = onWalletReconnectAsk(asked);
    try {
      act(() => result.current.retry());
      await waitFor(() => expect(mocks.readPool).toHaveBeenCalled());
      await waitFor(() => expect(asked).toHaveBeenCalledOnce());
      expect(result.current.status).toBe("registering_proposal");
      expect(result.current.poolRegistered).toBeNull();
      expect(result.current.txHash).toBe(txHash);
      expect(result.current.hypercertId).toBe("123");
      expect(mocks.readyWalletClient).not.toHaveBeenCalled();
      expect(mocks.register).not.toHaveBeenCalled();

      mocks.walletRestore = null;
      mocks.eoaAddress = `0x${"4".repeat(40)}`;
      rerender();
      expect(mocks.register).not.toHaveBeenCalled();
      expect(result.current.status).toBe("registering_proposal");
      mocks.eoaAddress = `0x${"1".repeat(40)}`;
      rerender();
      await waitFor(() => expect(result.current.status).toBe("confirmed"));
      expect(result.current.poolRegistered).toBe(true);
      expect(result.current.userOpHash).toBe(hash);
      expect(result.current.txHash).toBe(txHash);
      expect(mocks.register).toHaveBeenCalledOnce();
      expect(mocks.buildAndSign).toHaveBeenCalledOnce();
      expect(mocks.upload).toHaveBeenCalledTimes(2);
      expect(mocks.pollForReceipt).toHaveBeenCalledTimes(2);
    } finally {
      stop();
    }
  });
});
