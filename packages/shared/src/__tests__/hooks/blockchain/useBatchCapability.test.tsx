import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBatchCapability } from "../../../hooks/blockchain/useBatchCapability";
import type { BatchScope } from "../../../modules/transactions/batch-types";
import type { TransactionSender } from "../../../modules/transactions/types";
import type { Address } from "../../../types/domain";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithProviders } from "../../test-utils/render-helpers";

const connection = vi.hoisted(() => ({ uid: "first-wallet" }));
vi.mock("wagmi", () => ({ useAccount: () => ({ connector: { uid: connection.uid } }) }));
const account = "0x1111111111111111111111111111111111111111" as Address;
const other = "0x2222222222222222222222222222222222222222" as Address;
const makeSender = () =>
  ({
    getBatchCapability: vi.fn(async (scope: BatchScope) => ({ ...scope, atomic: "supported" })),
  }) as unknown as TransactionSender;

beforeEach(() => {
  connection.uid = "first-wallet";
});

describe("shared batch capability reads", () => {
  it("shares one in-flight answer between routes for the same connected wallet", async () => {
    const sender = makeSender();
    const queryClient = createTestQueryClient();
    const input = { sender, account, chainId: 42161, enabled: true };
    const { result } = renderHookWithProviders(
      () => [useBatchCapability(input), useBatchCapability(input)],
      { queryClient }
    );
    await waitFor(() =>
      expect(result.current.map((query) => query.data)).toEqual(["supported", "supported"])
    );
    expect(sender.getBatchCapability).toHaveBeenCalledTimes(1);
  });

  it("never probes a route that is unlisted or lacks an account or capability reader", () => {
    const sender = makeSender();
    renderHookWithProviders(() => {
      useBatchCapability({ sender, account, chainId: 42161, enabled: false });
      useBatchCapability({ sender, account: null, chainId: 42161, enabled: true });
      return useBatchCapability({
        sender: {} as TransactionSender,
        account,
        chainId: 42161,
        enabled: true,
      });
    });
    expect(sender.getBatchCapability).not.toHaveBeenCalled();
  });

  it.each([
    "account",
    "chain",
    "connector",
  ])("does not reuse another %s's answer", async (changed) => {
    const sender = makeSender();
    let currentAccount = account;
    let chainId = 42161;
    const { result, rerender } = renderHookWithProviders(() =>
      useBatchCapability({ sender, account: currentAccount, chainId, enabled: true })
    );
    await waitFor(() => expect(result.current.data).toBe("supported"));
    if (changed === "account") currentAccount = other;
    if (changed === "chain") chainId = 1;
    if (changed === "connector") connection.uid = "second-wallet";
    rerender();
    await waitFor(() => expect(sender.getBatchCapability).toHaveBeenCalledTimes(2));
    expect(sender.getBatchCapability).toHaveBeenLastCalledWith({
      account: currentAccount,
      chainId,
    });
  });
});
