/**
 * The campaign jar sync hook, on today's flow and on a listed rail.
 * @vitest-environment happy-dom
 */

import "fake-indexeddb/auto";
import { act, waitFor } from "@testing-library/react";
import { toHex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CampaignJarSync,
  useCampaignCookieJarSync,
} from "../../../hooks/cookie-jar/useCampaignCookieJar";
import type { BatchExecution } from "../../../modules/transactions/batch-types";
import type { TransactionSender } from "../../../modules/transactions/types";
import type { Address } from "../../../types/domain";
import { classifyTxError } from "../../../utils/errors/tx-error-classifier";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithProviders } from "../../test-utils/render-helpers";
import {
  createFakeBatchingSender,
  createMockTransactionSender,
} from "../../test-utils/transaction-fakes";

const { auth, jar, sending, toasts, listing } = vi.hoisted(() => ({
  auth: { primaryAddress: null as string | null, passkeyAccountProfile: "kernel-0.3.1-legacy" },
  jar: { allowlist: [] as string[], metadata: "" },
  sending: { sender: null as unknown },
  toasts: { success: vi.fn(), info: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
  listing: { enabled: false },
}));

vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => sending.sender,
}));
vi.mock("../../../hooks/auth/useUser", () => ({ useUser: () => auth }));
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({ useCurrentChain: () => 42161 }));
vi.mock("wagmi", () => ({ useAccount: () => ({ connector: { uid: "test-wallet" } }) }));
vi.mock("../../../components/toast", () => ({ toastService: toasts }));
vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => vi.fn(),
}));
vi.mock("../../../modules/transactions/batch-enablement", () => ({
  isBatchEnabled: (query: { action: string }) =>
    listing.enabled && query.action === "campaign-jar-sync",
}));
vi.mock("../../../utils/blockchain/contracts", () => ({
  createClients: () => ({
    publicClient: {
      readContract: async ({ functionName }: { functionName: string }) =>
        functionName === "getAllowlist" ? jar.allowlist : jar.metadata,
      simulateContract: async () => ({}),
    },
  }),
}));

const hash = `0x${"ab".repeat(32)}` as const;
const CONFIRMED: Partial<BatchExecution> = {
  status: "confirmed",
  receipts: [{ transactionHash: hash, status: "success" }],
};
const randomAddress = (): Address => toHex(crypto.getRandomValues(new Uint8Array(20)));

/** A jar that grants `joining`, revokes `leaving`, and writes new metadata. */
function setup<Sender extends TransactionSender>(
  makeSender: (account: Address) => Sender = (account) =>
    createFakeBatchingSender(account, CONFIRMED) as Sender
) {
  const account = randomAddress();
  const jarAddress = randomAddress();
  const [leaving, joining] = [randomAddress(), randomAddress()];
  jar.allowlist = [leaving];
  jar.metadata = "old";
  auth.primaryAddress = account;
  const sender = makeSender(account);
  sending.sender = sender;
  const sync: CampaignJarSync = {
    jarAddress,
    grant: [joining],
    revoke: [leaving],
    metadata: { factoryAddress: randomAddress(), value: "new" },
  };
  const queryClient = createTestQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } });
  const view = renderHookWithProviders(() => useCampaignCookieJarSync(jarAddress), {
    queryClient,
  });
  const syncAndSettle = async (next = sync) => {
    act(() => view.result.current.send(next));
    // A cold journal can take more than the default second to open under a loaded run.
    await waitFor(() => expect(queryClient.isMutating()).toBe(0), { timeout: 5_000 });
    // The hook hears that the send ended on the next tick.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  };
  /** What the chain holds once the sync lands. */
  const land = () => Object.assign(jar, { allowlist: [joining], metadata: "new" });
  return { sender, sync, view, syncAndSettle, land };
}

describe("useCampaignCookieJarSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listing.enabled = false;
  });

  it("keeps today's prompts while nothing is listed: one per step, and no wallet is asked", async () => {
    // A wallet that could batch, so only the list keeps it on today's flow.
    const { sender, sync, view, syncAndSettle } = setup((account) =>
      Object.assign(createFakeBatchingSender(account, CONFIRMED), { authMode: "wallet" as const })
    );

    await syncAndSettle();

    expect(
      vi
        .mocked(sender.sendContractCall)
        .mock.calls.map(([call]) => [call.functionName, call.chainId])
    ).toEqual([
      ["grantJarAllowlistRole", 42161],
      ["revokeJarAllowlistRole", 42161],
      ["updateMetadata", 42161],
    ]);
    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
    expect(sender.getBatchCapability).not.toHaveBeenCalled();
    expect(view.result.current.signaturesFor(sync)).toBe(3);
    expect(toasts.success).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Allowlist synced" })
    );
  });

  it("proposes every step for a Safe, but never calls a proposal synced", async () => {
    const safe = createMockTransactionSender({
      authMode: "wallet",
      result: {
        hash: "0xsafe-proposal" as `0x${string}`,
        sponsored: false,
        confirmation: "pending",
      },
    });
    const { view, syncAndSettle } = setup(() => safe);

    await syncAndSettle();

    expect(safe.sendContractCall).toHaveBeenCalledTimes(3);
    expect(classifyTxError(view.result.current.error).kind).toBe("unconfirmed");
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it("sends the sync as one request on a listed rail, and calls it synced once the chain holds it", async () => {
    listing.enabled = true;
    const { sender, sync, view, syncAndSettle, land } = setup();
    expect(view.result.current.signaturesFor(sync)).toBe(1);
    const submit = sender.submitAtomicBatch!;
    sender.submitAtomicBatch = vi.fn(async (calls, options) => {
      land();
      return submit(calls, options);
    });

    await syncAndSettle();

    expect(sender.submitAtomicBatch).toHaveBeenCalledOnce();
    expect(sender.sendContractCall).not.toHaveBeenCalled();
    expect(view.result.current.error).toBeNull();
    expect(toasts.success).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Allowlist synced" })
    );
  });

  it("holds a sync in doubt, says what the chain holds, and frees the jar on Move On", async () => {
    listing.enabled = true;
    const { sender, view, syncAndSettle } = setup((account) => createFakeBatchingSender(account));

    await syncAndSettle();

    expect(classifyTxError(view.result.current.error).kind).toBe("unconfirmed");
    expect(toasts.success).not.toHaveBeenCalled();
    await waitFor(() => expect(view.result.current.isHeld).toBe(true));
    expect(view.result.current.holdFeedback?.detail).toBe(
      "On chain now: 0 of 1 granted. 0 of 1 revoked. Metadata not updated yet."
    );

    await act(async () => view.result.current.holdFeedback?.onMoveOn());
    await waitFor(() => expect(view.result.current.isHeld).toBe(false));
    await syncAndSettle();
    expect(sender.submitAtomicBatch).toHaveBeenCalledTimes(2);
  });

  it("takes another press to go step by step when the sync is past its ceilings", async () => {
    listing.enabled = true;
    const { sender, sync, view, syncAndSettle } = setup();
    sender.preflightBatch = async () => {
      throw new Error("batch-budget-exceeded");
    };

    await syncAndSettle();
    expect(classifyTxError(view.result.current.error).kind).toBe("overCeilings");
    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
    expect(view.result.current.signaturesFor(sync)).toBe(3);

    await syncAndSettle();
    expect(sender.sendContractCall).toHaveBeenCalledTimes(3);
  });
});
