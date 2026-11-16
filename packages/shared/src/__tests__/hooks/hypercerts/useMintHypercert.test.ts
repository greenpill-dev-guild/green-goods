/** @vitest-environment happy-dom */
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockHypercertDraft,
  createMockHypercertAttestation,
} from "../../test-utils/mock-factories";
import { renderHookWithProviders } from "../../test-utils/render-helpers";
import { formatHypercertMetadata, TOTAL_UNITS } from "../../../lib/hypercerts";
import { onWalletReconnectAsk } from "../../../modules/auth/wallet-reconnect";

const mocks = vi.hoisted(() => ({
  walletRestore: null as "restoring" | "failed" | null,
  authMode: "wallet" as "wallet" | "passkey",
  upload: vi.fn(),
  resolveContracts: vi.fn(),
  mintState: vi.fn(),
}));
vi.mock("../../../hooks/auth/useAuth", () => ({
  useAuth: () => ({
    authMode: mocks.authMode,
    walletRestore: mocks.walletRestore,
    eoaAddress: `0x${"1".repeat(40)}`,
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
});
