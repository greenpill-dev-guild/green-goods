/**
 * Marketplace Approval Management
 *
 * Handles the two one-time approval steps required before
 * an operator can list hypercerts on the marketplace:
 *
 * 1. TransferManager.grantApprovals([exchange]) -- allows the exchange
 *    to use the TransferManager to move the operator's tokens.
 * 2. HypercertMinter.setApprovalForAll(transferManager, true) -- allows
 *    the TransferManager to transfer the operator's hypercert fractions.
 *
 * @module modules/marketplace/approvals
 */

import { type Address, encodeFunctionData, type Hex } from "viem";

import { createPublicClientForChain } from "../../config";
import { TRANSFER_MANAGER_ABI } from "../../hooks/hypercerts/hypercert-abis";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { createLogger } from "../app/logger";

const log = createLogger({ source: "marketplace/approvals" });

// ---------------------------------------------------------------------------
// ERC1155 isApprovedForAll / setApprovalForAll ABI fragments
// ---------------------------------------------------------------------------

const ERC1155_APPROVAL_ABI = [
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarketplaceApprovals {
  exchangeApproved: boolean;
  minterApproved: boolean;
}

export interface EncodedApprovalCall {
  to: Address;
  data: Hex;
}

// ---------------------------------------------------------------------------
// Check approvals
// ---------------------------------------------------------------------------

/**
 * Check if operator has the two required one-time approvals:
 * 1. transferManager.hasUserApprovedOperator(user, exchange)
 * 2. hypercertMinter.isApprovedForAll(user, transferManager)
 */
export async function checkMarketplaceApprovals(
  operator: Address,
  chainId: number
): Promise<MarketplaceApprovals> {
  const contracts = getNetworkContracts(chainId);
  const publicClient = createPublicClientForChain(chainId);

  const exchangeAddress = contracts.hypercertExchange as Address;
  const transferManagerAddress = contracts.transferManager as Address;
  const minterAddress = contracts.hypercertMinter as Address;

  log.debug("Checking marketplace approvals", {
    operator,
    chainId,
    exchange: exchangeAddress,
    transferManager: transferManagerAddress,
    minter: minterAddress,
  });

  // Check both approvals in parallel
  const [exchangeApproved, minterApproved] = await Promise.all([
    // 1. Has the user approved the exchange via the TransferManager?
    publicClient.readContract({
      address: transferManagerAddress,
      abi: TRANSFER_MANAGER_ABI,
      functionName: "hasUserApprovedOperator",
      args: [operator, exchangeAddress],
    }) as Promise<boolean>,

    // 2. Has the user approved the TransferManager on the Minter?
    publicClient.readContract({
      address: minterAddress,
      abi: ERC1155_APPROVAL_ABI,
      functionName: "isApprovedForAll",
      args: [operator, transferManagerAddress],
    }) as Promise<boolean>,
  ]);

  log.debug("Marketplace approval status", {
    operator,
    chainId,
    exchangeApproved,
    minterApproved,
  });

  return { exchangeApproved, minterApproved };
}

// ---------------------------------------------------------------------------
// Build approval transactions
// ---------------------------------------------------------------------------

/**
 * Build the approval transactions for missing approvals.
 * Returns encoded calls that can be sent via writeContract.
 *
 * - grantExchange: calls TransferManager.grantApprovals([exchange])
 * - approveMinter: calls HypercertMinter.setApprovalForAll(transferManager, true)
 */
export async function buildApprovalTransactions(
  operator: Address,
  chainId: number
): Promise<{
  grantExchange?: EncodedApprovalCall;
  approveMinter?: EncodedApprovalCall;
}> {
  const { exchangeApproved, minterApproved } = await checkMarketplaceApprovals(operator, chainId);

  const contracts = getNetworkContracts(chainId);
  const exchangeAddress = contracts.hypercertExchange as Address;
  const transferManagerAddress = contracts.transferManager as Address;
  const minterAddress = contracts.hypercertMinter as Address;

  const result: {
    grantExchange?: EncodedApprovalCall;
    approveMinter?: EncodedApprovalCall;
  } = {};

  if (!exchangeApproved) {
    result.grantExchange = {
      to: transferManagerAddress,
      data: encodeFunctionData({
        abi: TRANSFER_MANAGER_ABI,
        functionName: "grantApprovals",
        args: [[exchangeAddress]],
      }),
    };

    log.info("Exchange approval needed", {
      operator,
      chainId,
      transferManager: transferManagerAddress,
      exchange: exchangeAddress,
    });
  }

  if (!minterApproved) {
    result.approveMinter = {
      to: minterAddress,
      data: encodeFunctionData({
        abi: ERC1155_APPROVAL_ABI,
        functionName: "setApprovalForAll",
        args: [transferManagerAddress, true],
      }),
    };

    log.info("Minter approval needed", {
      operator,
      chainId,
      minter: minterAddress,
      transferManager: transferManagerAddress,
    });
  }

  return result;
}
