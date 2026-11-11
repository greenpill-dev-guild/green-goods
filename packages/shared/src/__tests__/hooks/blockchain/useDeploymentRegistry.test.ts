/**
 * useDeploymentRegistry Hook Tests
 * @vitest-environment happy-dom
 *
 * Tests the deployment registry permission-checking hook. This hook creates a
 * viem PublicClient and reads on-chain state (owner, isInAllowlist) to determine
 * if the connected user has deploy permissions.
 */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MOCK_ADDRESSES } from "../../test-utils/mock-factories";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

// ============================================
// Mocks
// ============================================

const mockReadContract = vi.fn();

// Mock viem's createPublicClient to return a client with a mockable readContract
vi.mock("viem", () => ({
  createPublicClient: () => ({
    readContract: (...args: unknown[]) => mockReadContract(...args),
  }),
  http: (url: string) => ({ url }),
}));

// Track auth state for testing
let mockAuthContext = {
  authMode: "wallet" as "wallet" | "passkey" | null,
  isReady: true,
  isAuthenticated: true,
  walletAddress: MOCK_ADDRESSES.deployer as string | null,
  smartAccountAddress: null as string | null,
};

vi.mock("../../../providers/Auth", () => ({
  useAuthContext: () => mockAuthContext,
  useOptionalAuthContext: () => mockAuthContext,
}));

// Track wagmi state for testing
let mockWagmiAccount = {
  address: MOCK_ADDRESSES.deployer as string | undefined,
  isConnected: true,
};

vi.mock("wagmi", () => ({
  useAccount: () => mockWagmiAccount,
}));

// Admin store with selectedChainId
let mockSelectedChainId: number | null = null;

vi.mock("../../../stores/useAdminStore", () => ({
  useAdminStore: (selector: (state: { selectedChainId: number | null }) => unknown) =>
    selector({ selectedChainId: mockSelectedChainId }),
}));

// Mock blockchain config
vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
  getNetworkConfig: () => ({
    rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/demo",
  }),
}));

vi.mock("../../../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

// Mock network contracts
const mockDeploymentRegistryAddress = "0xDeploymentRegistry1234567890123456789012";

vi.mock("../../../utils/blockchain/contracts", () => ({
  getNetworkContracts: () => ({
    deploymentRegistry: mockDeploymentRegistryAddress,
  }),
  getChain: () => ({ id: 11155111, name: "Sepolia" }),
}));

// The managing hook's write path
const mockSendContractCall = vi.fn();
const mockSimulateTransaction = vi.fn();
const mockToastError = vi.fn();

vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => ({ sendContractCall: mockSendContractCall }),
}));

vi.mock("../../../utils/blockchain/simulation", () => ({
  simulateTransaction: (...args: unknown[]) => mockSimulateTransaction(...args),
}));

vi.mock("../../../components/toast", () => ({
  toastService: { error: (...args: unknown[]) => mockToastError(...args) },
}));

vi.mock("../../../hooks/app/useToastAction", () => ({
  useToastAction: () => ({ executeWithToast: (action: () => Promise<unknown>) => action() }),
}));

vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

// Mock address comparison
vi.mock("../../../utils/blockchain/address", () => ({
  compareAddresses: (a: string, b: string) => a?.toLowerCase() === b?.toLowerCase(),
  isZeroAddress: (addr: string | undefined | null) =>
    !addr || addr.toLowerCase() === "0x0000000000000000000000000000000000000000",
}));

// Mock logger
vi.mock("../../../modules/app/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock appkit config
vi.mock("../../../config/appkit", () => ({
  getWagmiConfig: () => ({}),
}));

import {
  useDeploymentRegistry,
  useGardenCreators,
} from "../../../hooks/blockchain/useDeploymentRegistry";
import {
  TransactionConfirmationPendingError,
  TransactionRevertedError,
} from "../../../modules/transactions/types";
import { WalletWriteNotRetriedError } from "../../../utils/errors/wallet-network-refusal";

// ============================================
// Tests
// ============================================

describe("useDeploymentRegistry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthContext = {
      authMode: "wallet",
      isReady: true,
      isAuthenticated: true,
      walletAddress: MOCK_ADDRESSES.deployer,
      smartAccountAddress: null,
    };
    mockWagmiAccount = {
      address: MOCK_ADDRESSES.deployer,
      isConnected: true,
    };
    mockSelectedChainId = null;
  });

  // ------------------------------------------
  // Loading state
  // ------------------------------------------

  describe("loading state", () => {
    it("starts in loading state", () => {
      mockReadContract.mockResolvedValue(MOCK_ADDRESSES.deployer);

      const { result } = renderHookWithQueryClient(() => useDeploymentRegistry());

      expect(result.current.loading).toBe(true);
    });

    it("stays in loading state when not connected", async () => {
      mockWagmiAccount = { address: undefined, isConnected: false };
      mockAuthContext = {
        ...mockAuthContext,
        isReady: true,
        isAuthenticated: false,
        walletAddress: null,
      };

      const { result } = renderHookWithQueryClient(() => useDeploymentRegistry());

      // Should remain loading since no address is available
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });
      expect(result.current.canDeploy).toBe(false);
    });
  });

  // ------------------------------------------
  // Owner check
  // ------------------------------------------

  describe("owner permissions", () => {
    it("detects when user is the owner", async () => {
      // First call: owner() returns user's address
      // Second call: isInAllowlist() returns false
      mockReadContract.mockResolvedValueOnce(MOCK_ADDRESSES.deployer).mockResolvedValueOnce(false);

      const { result } = renderHookWithQueryClient(() => useDeploymentRegistry());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isOwner).toBe(true);
      expect(result.current.canDeploy).toBe(true);
    });

    it("detects when user is NOT the owner", async () => {
      mockReadContract
        .mockResolvedValueOnce("0xSomeOtherOwner123456789012345678901234")
        .mockResolvedValueOnce(false);

      const { result } = renderHookWithQueryClient(() => useDeploymentRegistry());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isOwner).toBe(false);
      expect(result.current.canDeploy).toBe(false);
    });
  });

  // ------------------------------------------
  // Allowlist check
  // ------------------------------------------

  describe("allowlist permissions", () => {
    it("detects when user is in the allowlist", async () => {
      mockReadContract
        .mockResolvedValueOnce("0xSomeOtherOwner123456789012345678901234")
        .mockResolvedValueOnce(true);

      const { result } = renderHookWithQueryClient(() => useDeploymentRegistry());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isOwner).toBe(false);
      expect(result.current.isInAllowlist).toBe(true);
      expect(result.current.canDeploy).toBe(true);
    });

    it("canDeploy is true when user is both owner AND in allowlist", async () => {
      mockReadContract.mockResolvedValueOnce(MOCK_ADDRESSES.deployer).mockResolvedValueOnce(true);

      const { result } = renderHookWithQueryClient(() => useDeploymentRegistry());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isOwner).toBe(true);
      expect(result.current.isInAllowlist).toBe(true);
      expect(result.current.canDeploy).toBe(true);
    });
  });

  // ------------------------------------------
  // Error handling
  // ------------------------------------------

  describe("error handling", () => {
    it("sets error state and returns all-false on RPC failure", async () => {
      mockReadContract.mockRejectedValue(new Error("RPC connection failed"));

      const { result } = renderHookWithQueryClient(() => useDeploymentRegistry());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("RPC connection failed");
      expect(result.current.isOwner).toBe(false);
      expect(result.current.isInAllowlist).toBe(false);
      expect(result.current.canDeploy).toBe(false);
    });

    it("handles non-Error exceptions gracefully", async () => {
      mockReadContract.mockRejectedValue("string error");

      const { result } = renderHookWithQueryClient(() => useDeploymentRegistry());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Unknown error");
      expect(result.current.canDeploy).toBe(false);
    });
  });

  // ------------------------------------------
  // Address priority
  // ------------------------------------------

  describe("primary account permissions", () => {
    it.each([
      undefined,
      MOCK_ADDRESSES.deployer,
    ])("checks the passkey account with companion wallet %s", async (address) => {
      mockWagmiAccount = { address, isConnected: Boolean(address) };
      mockAuthContext = {
        ...mockAuthContext,
        authMode: "passkey",
        smartAccountAddress: MOCK_ADDRESSES.steward,
      };
      mockReadContract.mockResolvedValueOnce(MOCK_ADDRESSES.steward).mockResolvedValueOnce(false);
      const { result } = renderHookWithQueryClient(() => useDeploymentRegistry());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.isOwner).toBe(true);
      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "isInAllowlist",
          args: [MOCK_ADDRESSES.steward.toLowerCase()],
        })
      );
    });
    it("does not borrow a companion wallet's deployer role", async () => {
      mockAuthContext = {
        ...mockAuthContext,
        authMode: "passkey",
        smartAccountAddress: MOCK_ADDRESSES.steward,
      };
      mockReadContract.mockResolvedValueOnce(MOCK_ADDRESSES.deployer).mockResolvedValueOnce(false);
      const { result } = renderHookWithQueryClient(() => useDeploymentRegistry());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.canDeploy).toBe(false);
    });
    it("does not use a connected wallet while signed out", async () => {
      mockAuthContext = { ...mockAuthContext, authMode: null, isAuthenticated: false };
      const { result } = renderHookWithQueryClient(() => useDeploymentRegistry());
      expect(result.current.canDeploy).toBe(false);
      expect(mockReadContract).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // Zero address registry (placed last because vi.spyOn overrides module mock)
  // ------------------------------------------

  describe("unconfigured registry", () => {
    it("returns all-false when registry is zero address", async () => {
      // Override getNetworkContracts to return zero address via vi.spyOn
      const contractsMock = await import("../../../utils/blockchain/contracts");
      const configuredContracts = contractsMock.getNetworkContracts(11155111);
      const spy = vi.spyOn(contractsMock, "getNetworkContracts").mockReturnValue({
        ...configuredContracts,
        deploymentRegistry: "0x0000000000000000000000000000000000000000",
      });

      const { result } = renderHookWithQueryClient(() => useDeploymentRegistry());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isOwner).toBe(false);
      expect(result.current.isInAllowlist).toBe(false);
      expect(result.current.canDeploy).toBe(false);
      expect(mockReadContract).not.toHaveBeenCalled();

      // Restore the spy to avoid leaking into other tests
      spy.mockRestore();
    });
  });

  describe("useGardenCreators", () => {
    const creator = "0x2222222222222222222222222222222222222222" as const;
    const registryAnswers = (answers: {
      canManage: boolean | Error;
      allowlist?: string[] | Error;
    }) =>
      mockReadContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
        const answer =
          functionName === "canManageAllowlist" ? answers.canManage : (answers.allowlist ?? []);
        if (answer instanceof Error) throw answer;
        return answer;
      });

    beforeEach(() => {
      mockSendContractCall.mockReset();
      mockSimulateTransaction.mockReset();
      mockToastError.mockReset();
    });

    it("reads the allowlist for an account the registry lets manage it", async () => {
      registryAnswers({ canManage: true, allowlist: [creator] });

      const { result } = renderHookWithQueryClient(() => useGardenCreators());

      await waitFor(() => expect(result.current.creators).toEqual([creator]));
      expect(result.current.canManage).toBe(true);
      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "canManageAllowlist",
          args: [MOCK_ADDRESSES.deployer.toLowerCase()],
        })
      );
    });

    it("treats a registry that cannot answer as no permission and leaves the list unread", async () => {
      // What a registry from before this check does: it reverts on the unknown function.
      registryAnswers({ canManage: new Error("execution reverted") });

      const { result } = renderHookWithQueryClient(() => useGardenCreators());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.canManage).toBe(false);
      expect(result.current.creators).toEqual([]);
      expect(mockReadContract).not.toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "getAllowlist" })
      );
    });

    it("simulates, then sends the add, and reports that the wallet accepted", async () => {
      registryAnswers({ canManage: true, allowlist: [] });
      mockSimulateTransaction.mockResolvedValue({ success: true });
      mockSendContractCall.mockResolvedValue({ hash: `0x${"1".repeat(64)}`, sponsored: false });

      const { result } = renderHookWithQueryClient(() => useGardenCreators());
      await waitFor(() => expect(result.current.canManage).toBe(true));

      await expect(result.current.addCreator(creator)).resolves.toBe(true);

      expect(mockSendContractCall).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockDeploymentRegistryAddress,
          // Bound to the account the simulation and the permission read were for.
          account: MOCK_ADDRESSES.deployer,
          functionName: "addToAllowlist",
          args: [creator],
        }),
        expect.objectContaining({ assertOwnership: expect.any(Function) })
      );
      expect(mockSimulateTransaction.mock.invocationCallOrder[0]).toBeLessThan(
        mockSendContractCall.mock.invocationCallOrder[0]
      );
    });

    it.each([
      {
        when: "the registry refuses the change",
        reverted: true,
        says: "You can't change this list",
      },
      {
        // An RPC that answers with an error page parses to a code, which would read as a refusal.
        when: "the check itself cannot run",
        reverted: false,
        says: "cockpit.community.gardenCreators.checkFailed",
      },
    ])("never opens the wallet when $when", async ({ reverted, says }) => {
      registryAnswers({ canManage: true, allowlist: [creator] });
      mockSimulateTransaction.mockResolvedValue({
        success: false,
        error: { name: "UnauthorizedCaller", message: "You can't change this list", reverted },
      });

      const { result } = renderHookWithQueryClient(() => useGardenCreators());
      await waitFor(() => expect(result.current.canManage).toBe(true));

      await expect(result.current.removeCreator(creator)).resolves.toBe(false);

      expect(mockSendContractCall).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith(expect.objectContaining({ message: says }));
    });

    /** The sender reaches the point where the call could leave, then ends as `outcome` does. */
    const afterBroadcast =
      (outcome: () => Promise<unknown>) =>
      async (_call: unknown, options?: { onBeforeBroadcast?: () => Promise<void> }) => {
        await options?.onBeforeBroadcast?.();
        return outcome();
      };

    it.each([
      {
        when: "the sender is still waiting for a confirmation",
        send: async () => {
          throw new TransactionConfirmationPendingError();
        },
      },
      {
        when: "a wallet queues the call, as a Safe does",
        send: async () => ({
          hash: `0x${"2".repeat(64)}`,
          sponsored: false,
          confirmation: "pending",
        }),
      },
      {
        when: "the receipt cannot be read after the call went out",
        send: afterBroadcast(async () => {
          throw new Error("HTTP request failed. Status: 503");
        }),
      },
    ])("counts a change that may still land as sent, never offering it again, when $when", async ({
      send,
    }) => {
      registryAnswers({ canManage: true, allowlist: [] });
      mockSimulateTransaction.mockResolvedValue({ success: true });
      mockSendContractCall.mockImplementation(send);

      const { result } = renderHookWithQueryClient(() => useGardenCreators());
      await waitFor(() => expect(result.current.canManage).toBe(true));

      await expect(result.current.addCreator(creator)).resolves.toBe(true);
    });

    it.each([
      { when: "the person declines the signature", error: new Error("User rejected the request") },
      {
        when: "the receipt shows a revert",
        error: new TransactionRevertedError(`0x${"3".repeat(64)}`),
      },
      {
        // viem refused the write for the wallet's network and the check before a retry failed.
        when: "the wallet changed network and the write was not tried again",
        error: new WalletWriteNotRetriedError(new Error("Switch to Arbitrum failed")),
      },
    ])("reports the change as not sent when $when", async ({ error }) => {
      registryAnswers({ canManage: true, allowlist: [] });
      mockSimulateTransaction.mockResolvedValue({ success: true });
      mockSendContractCall.mockImplementation(
        afterBroadcast(async () => {
          throw error;
        })
      );

      const { result } = renderHookWithQueryClient(() => useGardenCreators());
      await waitFor(() => expect(result.current.canManage).toBe(true));

      await expect(result.current.addCreator(creator)).resolves.toBe(false);
      await waitFor(() => expect(result.current.isWriting).toBe(false));
    });
  });
});
