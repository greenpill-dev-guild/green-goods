import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { commitmentPoolingKeys } from "../../../config/query-keys/commitment-pooling";
import {
  type ServiceIssuerDrafts,
  useServiceIssuerApproval,
  useServiceIssuerDrafts,
} from "../../../hooks/commitment-pooling/useServiceIssuerOnboarding";
import type { ServiceIssuerDraft } from "../../../modules/commitment-pooling/service-issuer-approval";
import type {
  AccountTypedDataRequest,
  TransactionSender,
} from "../../../modules/transactions/types";
import { AuthContext, type AuthContextType } from "../../../providers/authContext";
import type { Address } from "../../../types/domain";
import { createTestQueryClient } from "../../test-utils/query-client";

const MEMBER = "0x0000000000000000000000000000000000000007" as Address;
const STEWARD = "0x0000000000000000000000000000000000000008" as Address;
const SIGNATURE = `0x${"5".repeat(130)}` as const;

const sender = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => sender.current,
}));

function draft(): ServiceIssuerDraft {
  return {
    version: 1,
    id: "7",
    member: MEMBER,
    memberName: "Fictional member",
    preparedBy: "Fictional steward",
    garden: "Fictional garden",
    sourceChainId: 42161,
    sentAt: 1n,
    changed: [],
    terms: {
      revision: 1,
      service: {
        title: "Lesson",
        buys: "One lesson",
        scope: "Remote",
        remedy: "By minutes",
        unit: "minutes",
      },
      token: { name: "Fictional vouchers", symbol: "FV", decimals: 6 },
      capacity: { units: 6_000_000n, weeks: 4 },
      issue: { total: 6_000_000n, pool: 2_000_000n },
      rewardAllowance: 1_000_000n,
      poolHoldingCap: 6_000_000n,
      priceIndex: 2_000_000n,
      poolFee: 0n,
      replyBusinessDays: 2,
      acceptanceDays: 7,
      document: { reference: "https://example.org/terms", digest: `0x${"d".repeat(64)}` },
    },
  };
}

function fixture(signedIn: Address, authMode: "passkey" | "embedded" = "passkey") {
  const signTypedData = vi.fn(async (_request: AccountTypedDataRequest) => SIGNATURE);
  sender.current = {
    authMode: "passkey",
    supportsSponsorship: true,
    supportsBatching: false,
    assertOwnership: async (account: Address) => {
      if (account !== signedIn) throw new Error("Wallet ownership mismatch");
    },
    signTypedData,
    sendContractCall: vi.fn(),
  } satisfies TransactionSender;
  const auth = {
    authMode,
    isReady: true,
    isAuthenticated: true,
    smartAccountAddress: signedIn,
    passkeyAccountProfile: "kernel-0.3.3-pilot",
    walletAddress: null,
    embeddedAddress: null,
  } as unknown as AuthContextType;
  const client = createTestQueryClient();
  const seeded: ServiceIssuerDrafts = {
    status: "observed",
    records: [{ draft: draft(), approval: null, declinedAt: null }],
  };
  client.setQueryData(commitmentPoolingKeys.issuerDrafts(MEMBER), seeded);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
  return { wrapper, signTypedData };
}

describe("member issuer onboarding hooks", () => {
  it("leaves drafts unavailable until a draft desk exists", async () => {
    const { result } = renderHook(() => useServiceIssuerDrafts(STEWARD), fixture(STEWARD));
    await waitFor(() => expect(result.current.data).toEqual({ status: "unavailable" }));
  });

  it("signs the draft from the member's own account and keeps the approval with the draft", async () => {
    const f = fixture(MEMBER);
    const { result } = renderHook(
      () => ({ approve: useServiceIssuerApproval(), drafts: useServiceIssuerDrafts(MEMBER) }),
      f
    );
    expect(result.current.approve.canSign).toBe(true);
    await act(async () => {
      await result.current.approve.approve.mutateAsync(draft());
    });
    expect(f.signTypedData).toHaveBeenCalledOnce();
    expect(f.signTypedData.mock.calls[0]![0]).toMatchObject({ account: MEMBER, chainId: 100 });
    await waitFor(() =>
      expect(result.current.drafts.data).toMatchObject({
        records: [{ approval: { member: MEMBER, revision: 1, signature: SIGNATURE } }],
      })
    );
  });

  it("tells an account that can't sign on the voucher network so the draft waits visibly", () => {
    const { result } = renderHook(() => useServiceIssuerApproval(), fixture(MEMBER, "embedded"));
    expect(result.current.canSign).toBe(false);
  });

  it("never signs a member's draft from a steward's session", async () => {
    const f = fixture(STEWARD);
    const { result } = renderHook(() => useServiceIssuerApproval(), f);
    await act(async () => {
      await expect(result.current.approve.mutateAsync(draft())).rejects.toThrow("Service account");
    });
    expect(f.signTypedData).not.toHaveBeenCalled();
  });
});
