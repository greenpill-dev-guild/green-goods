/**
 * The wallet's answer to a send: waiting for it, and what it is (PRD-1551).
 *
 * The person can stop waiting for a wallet that has not answered. The wallet may still hold the
 * request, so an answer that comes after that is handed on rather than dropped.
 *
 * A Safe is a contract, so it cannot send a transaction itself. Safe{Wallet} answers a send with
 * the proposal's own hash (its safeTxHash): 32 bytes, so it looks like a transaction hash, but no
 * transaction has it and no receipt ever comes. The proposal lands only once the Safe's owners
 * approve it and someone runs it, under another hash. A receipt wait on that answer has nothing to
 * wait for (from the PRD-1262 fork walk).
 *
 * @module modules/transactions/wallet-answer
 */

import { type Hex, parseAbi } from "viem";
import type { Address } from "../../types/domain";
import { WalletAnswerAbandonedError } from "./types";

/**
 * The wallet's answer, or `WalletAnswerAbandonedError` once the person stops waiting for it. An
 * answer that comes after that goes to `late`, since the wallet may still send what it was asked.
 */
export function untilAbandoned<T>(
  answer: Promise<T>,
  signal: AbortSignal | undefined,
  late: (value: T) => void
): Promise<T> {
  if (!signal) return answer;
  return new Promise<T>((resolve, reject) => {
    let abandoned = signal.aborted;
    if (abandoned) reject(new WalletAnswerAbandonedError());
    const abandon = () => {
      abandoned = true;
      reject(new WalletAnswerAbandonedError());
    };
    signal.addEventListener("abort", abandon, { once: true });
    answer.then(
      (value) => {
        signal.removeEventListener("abort", abandon);
        if (abandoned) late(value);
        else resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abandon);
        if (!abandoned) reject(error);
      }
    );
  });
}

/** What the wallet's answer to a send is: a transaction, or a proposal for a Safe's owners. */
export type WalletAnswer = "transaction" | "safe-proposal";

/** The reads that tell a Safe's proposal from a transaction, as a viem public client answers them. */
export interface WalletAnswerReader {
  getCode(args: { address: Address }): Promise<Hex | undefined>;
  readContract(args: {
    address: Address;
    abi: typeof SAFE_THRESHOLD_ABI;
    functionName: "getThreshold";
  }): Promise<bigint>;
  getTransaction(args: { hash: Hex }): Promise<unknown>;
}

const SAFE_THRESHOLD_ABI = parseAbi(["function getThreshold() view returns (uint256)"]);

/** An account an EIP-7702 delegation upgraded: its code points elsewhere, and it still sends. */
const DELEGATED_ACCOUNT_CODE = /^0xef0100[0-9a-f]{40}$/i;

/**
 * Whether `hash`, the wallet's answer to a send from `account`, is a Safe proposal.
 *
 * It is when the account is a Safe (a contract that answers `getThreshold`) and the network knows
 * no transaction by that hash. A plain account, a delegated one, or another kind of smart account
 * sends transactions, so its answer is waited on as one. A read that fails says nothing either way,
 * so the answer stays a transaction: its receipt wait has its own limit and cannot hang. Only a
 * transaction read that fails for a Safe leaves the proposal, since a Safe's wallet answers with one.
 */
export async function readWalletAnswer(
  reader: WalletAnswerReader,
  account: Address,
  hash: Hex
): Promise<WalletAnswer> {
  try {
    const code = await reader.getCode({ address: account });
    if (!code || code === "0x" || DELEGATED_ACCOUNT_CODE.test(code)) return "transaction";
    const threshold = await reader.readContract({
      address: account,
      abi: SAFE_THRESHOLD_ABI,
      functionName: "getThreshold",
    });
    if (typeof threshold !== "bigint" || threshold < 1n) return "transaction";
  } catch {
    return "transaction";
  }
  try {
    await reader.getTransaction({ hash });
    // An owner or a relayer already ran it, and answered with the run's own hash.
    return "transaction";
  } catch {
    return "safe-proposal";
  }
}
