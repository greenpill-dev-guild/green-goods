/**
 * Reading a garden's reward Safe on the payout chain
 *
 * What a payment and a signer update read from the chain: the Safe's owners, threshold, nonce and
 * approvals; the payer's record of a share; the token balance the Safe holds; and, from the
 * Safe's Hats Signer Gate, which owners it still counts as signers and who wears the steward hat.
 *
 * @module modules/commitment-pooling/reward-safe-chain
 */

import { readContract } from "@wagmi/core";
import { type Abi, type Hex, parseAbi, zeroAddress } from "viem";
import { getWagmiConfig } from "../../config/appkit";
import type { Address } from "../../types/domain";
import { ERC20_BALANCE_ABI } from "../../utils/blockchain/abis/erc20";
import { REWARD_PAYER_ABI } from "./reward-payer";

export const REWARD_SAFE_ABI = parseAbi([
  "function nonce() view returns (uint256)",
  "function getThreshold() view returns (uint256)",
  "function getOwners() view returns (address[])",
  "function approvedHashes(address owner, bytes32 hash) view returns (uint256)",
  "function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)",
  "function approveHash(bytes32 hashToApprove)",
  "function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) payable returns (bool success)",
]);

/** The Hats Signer Gate v2 calls a garden Safe's signer upkeep uses. */
export const REWARD_SAFE_GATE_ABI = parseAbi([
  "function safe() view returns (address)",
  "function HATS() view returns (address)",
  "function isValidSigner(address account) view returns (bool)",
  "function claimSigner(uint256 hatId)",
  "function removeSigner(address signer)",
]);

const HATS_WEARER_ABI = parseAbi([
  "function isWearerOfHat(address wearer, uint256 hatId) view returns (bool)",
]);

/** What a payment reads from the payout chain. */
export interface RewardPayChain {
  balance(token: Address, owner: Address): Promise<bigint>;
  /** Who paid a share; the zero address while it is unpaid. */
  paidBy(payer: Address, shareId: Hex): Promise<Address>;
  /** A Safe's owners, how many of them must approve, and the nonce its next transaction takes. */
  safeState(safe: Address): Promise<{ owners: Address[]; threshold: bigint; nonce: bigint }>;
  /** The hash the Safe records approvals of a transaction under. */
  safeTransactionHash(
    safe: Address,
    transaction: { to: Address; data: Hex; operation: number; nonce: bigint }
  ): Promise<Hex>;
  /** Whether an owner has approved a transaction hash on chain. */
  approvedHash(safe: Address, owner: Address, hash: Hex): Promise<boolean>;
  /** The Safe a gate guards, and which of the given accounts it counts as signers now. */
  gateState(
    gate: Address,
    accounts: readonly Address[]
  ): Promise<{ safe: Address; valid: boolean[] }>;
  /** Whether an account wears a hat now, as the gate's Hats Protocol instance says. */
  wearsHat(gate: Address, account: Address, hat: bigint): Promise<boolean>;
}

/** The payout chain as the app's wallet configuration reads it. */
export function createRewardPayChain(chainId: number): RewardPayChain {
  const read = <T>(request: {
    address: Address;
    abi: Abi;
    functionName: string;
    args: unknown[];
  }) => readContract(getWagmiConfig(), { ...request, chainId }) as Promise<T>;
  const safeRead = <T>(safe: Address, functionName: string, args: unknown[] = []) =>
    read<T>({ address: safe, abi: REWARD_SAFE_ABI as unknown as Abi, functionName, args });
  return {
    balance: (token, owner) =>
      read<bigint>({
        address: token,
        abi: ERC20_BALANCE_ABI as unknown as Abi,
        functionName: "balanceOf",
        args: [owner],
      }),
    paidBy: (payer, shareId) =>
      read<Address>({
        address: payer,
        abi: REWARD_PAYER_ABI as unknown as Abi,
        functionName: "paidBy",
        args: [shareId],
      }),
    safeState: async (safe) => {
      const [owners, threshold, nonce] = await Promise.all([
        safeRead<readonly Address[]>(safe, "getOwners"),
        safeRead<bigint>(safe, "getThreshold"),
        safeRead<bigint>(safe, "nonce"),
      ]);
      return { owners: [...owners], threshold, nonce };
    },
    safeTransactionHash: (safe, transaction) =>
      safeRead<Hex>(safe, "getTransactionHash", [
        transaction.to,
        0n,
        transaction.data,
        transaction.operation,
        0n,
        0n,
        0n,
        zeroAddress,
        zeroAddress,
        transaction.nonce,
      ]),
    approvedHash: async (safe, owner, hash) =>
      (await safeRead<bigint>(safe, "approvedHashes", [owner, hash])) !== 0n,
    gateState: async (gate, accounts) => {
      const gateRead = <T>(functionName: string, args: unknown[] = []) =>
        read<T>({ address: gate, abi: REWARD_SAFE_GATE_ABI as unknown as Abi, functionName, args });
      const [safe, valid] = await Promise.all([
        gateRead<Address>("safe"),
        Promise.all(accounts.map((account) => gateRead<boolean>("isValidSigner", [account]))),
      ]);
      return { safe, valid };
    },
    wearsHat: async (gate, account, hat) => {
      const hats = await read<Address>({
        address: gate,
        abi: REWARD_SAFE_GATE_ABI as unknown as Abi,
        functionName: "HATS",
        args: [],
      });
      return read<boolean>({
        address: hats,
        abi: HATS_WEARER_ABI as unknown as Abi,
        functionName: "isWearerOfHat",
        args: [account, hat],
      });
    },
  };
}
