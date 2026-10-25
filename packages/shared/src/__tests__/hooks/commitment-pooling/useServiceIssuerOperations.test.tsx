import { type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider } from "wagmi";
import { gnosis } from "viem/chains";
import { AuthContext, type AuthContextType } from "../../../providers/authContext";
import { useServiceIssuerOperations } from "../../../hooks/commitment-pooling/useServiceIssuerOperations";
import type {
  ServiceIssuerActor,
  ServiceIssuerReview,
} from "../../../modules/commitment-pooling/service-issuer-types";
import { createTestQueryClient } from "../../test-utils/query-client";
import { createMockContractCall } from "../../test-utils/transaction-fakes";

const address = "0x0000000000000000000000000000000000000002" as const;
const H = `0x${"a".repeat(64)}` as const;
const actor: ServiceIssuerActor = { address, routeId: "unconfigured-test", assetId: "test-asset" };
function fixture() {
  const auth: AuthContextType = {
    authMode: "wallet",
    isReady: true,
    isAuthenticated: true,
    isAuthenticating: false,
    error: null,
    credential: null,
    smartAccountAddress: null,
    passkeyAccountProfile: null,
    smartAccountClient: null,
    resolveSmartAccountClient: null,
    userName: null,
    hasStoredCredential: false,
    walletAddress: address,
    eoaAddress: address,
    embeddedAddress: null,
    externalWalletConnected: false,
    externalWalletAddress: null,
    createAccount: async () => {},
    loginWithPasskey: async () => {},
    loginWithWallet: () => {},
    loginWithEmbedded: () => {},
    signOut: async () => {},
    switchToWallet: () => {},
    switchToPasskey: () => {},
    retry: () => {},
    dismissError: () => {},
    clearPasskey: () => {},
    disconnectWallet: async () => {},
  };
  const client = createTestQueryClient();
  const config = createConfig({
    chains: [gnosis],
    transports: { 100: http("https://unused.invalid") },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <WagmiProvider config={config} reconnectOnMount={false}>
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
  return { wrapper: Wrapper };
}
describe("issuer operation hook composition", () => {
  it("does not invent data when no actor is selected", async () => {
    const { result } = renderHook(() => useServiceIssuerOperations(null), fixture());
    expect(result.current.snapshot.fetchStatus).toBe("idle");
    await act(async () => {
      await expect(
        result.current.review.mutateAsync({ kind: "issue", amount: 1n })
      ).rejects.toThrow("Select");
    });
  });
  it("reads an empty live catalog as explicitly unavailable without contacting a chain", async () => {
    const { result } = renderHook(() => useServiceIssuerOperations(actor), fixture());
    await waitFor(() =>
      expect(result.current.snapshot.data).toEqual({
        evidence: "unavailable",
        reason: "unconfigured",
      })
    );
  });
  it("does not substitute a fictional quote or retry missing live configuration", async () => {
    const { result } = renderHook(() => useServiceIssuerOperations(actor), fixture());
    await act(async () => {
      await expect(
        result.current.quote.mutateAsync({ outputAssetId: "another", amount: 1n })
      ).rejects.toThrow("configuration");
    });
    await waitFor(() => expect(result.current.quote.failureCount).toBe(1));
  });
  it("rejects a review for a previously selected asset before invoking the sender", async () => {
    const { result, rerender } = renderHook(
      (selected: ServiceIssuerActor) => useServiceIssuerOperations(selected),
      { ...fixture(), initialProps: actor }
    );
    const old: ServiceIssuerReview = {
      version: 1,
      evidence: "live-review",
      actor,
      action: { kind: "issue", amount: 1n },
      session: "synthetic",
      configuration: H,
      state: H,
      expected: {},
      expiresAt: 1n,
      call: createMockContractCall({ account: address, chainId: 100 }),
      fingerprint: H,
    };
    rerender({ ...actor, assetId: "changed" });
    await act(async () => {
      await expect(result.current.execute.mutateAsync(old)).rejects.toThrow("context changed");
    });
  });
});
