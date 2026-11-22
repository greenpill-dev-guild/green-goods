/** @vitest-environment happy-dom */

import { onlineManager } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePromiseRewardShares } from "../hooks/commitment-pooling/useRewardShares";
import type { RewardLeg } from "../modules/commitment-pooling/reward-legs";
import type { Address } from "../types/domain";
import { createTestQueryClient } from "./test-utils/query-client";
import { renderHookWithProviders } from "./test-utils/render-helpers";

const mocks = vi.hoisted(() => ({ readRecipients: vi.fn() }));

vi.mock("../utils/blockchain/contracts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/blockchain/contracts")>()),
  getRewardPayerDeployment: () => ({
    address: "0x4444444444444444444444444444444444444444",
    deployBlock: 1n,
  }),
}));
vi.mock("../modules/commitment-pooling/data-settlement-chain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../modules/commitment-pooling/data-settlement-chain")>()),
  readPayoutShareRecipients: mocks.readRecipients,
}));

const LEG: RewardLeg = {
  rail: "steward-wallet",
  chainId: 42161,
  token: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as Address,
  symbol: "USDC",
  decimals: 6,
  amount: 20_000_000n,
  usdCentsAsSet: 2_000n,
};

describe("usePromiseRewardShares", () => {
  // TanStack reports a read paused offline as neither loading nor failed. It still hasn't
  // answered, so no part may read as owed.
  it("reads as unanswered while a read is paused offline", async () => {
    mocks.readRecipients.mockResolvedValue({ finalized: false, recipients: [] });
    onlineManager.setOnline(false);
    try {
      const { result } = renderHookWithProviders(
        () => usePromiseRewardShares({ chainId: 42161, commitmentId: 19n, legs: [LEG] }),
        { queryClient: createTestQueryClient() }
      );
      expect(result.current.isReading).toBe(true);
      expect(result.current.readFailed).toBe(false);
      expect(mocks.readRecipients).not.toHaveBeenCalled();

      onlineManager.setOnline(true);
      await waitFor(() => expect(result.current.isReading).toBe(false));
      expect(result.current.splitFixed).toBe(false);
    } finally {
      onlineManager.setOnline(true);
    }
  });
});
