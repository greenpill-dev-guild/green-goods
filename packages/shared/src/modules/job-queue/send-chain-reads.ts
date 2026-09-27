/**
 * What the chain says about a queued send whose answer was lost
 *
 * Work, decisions and commitment acts each record a send before it can reach
 * the network, and a later run settles what is on record instead of sending it
 * again. These reads back the guards on that settle (`send-guards`). Each can
 * only keep a send waiting, and one that is missing or fails keeps it waiting.
 * The chain's head, read just before a send, is kept with its intent.
 *
 * @module modules/job-queue/send-chain-reads
 */

import {
  getBlock as wagmiGetBlock,
  getBytecode as wagmiGetBytecode,
  getTransaction as wagmiGetTransaction,
  getTransactionCount as wagmiGetTransactionCount,
  type Config,
} from "@wagmi/core";
import type { Hex } from "viem";
import { getWagmiConfig } from "../../config/appkit";
import { createPimlicoClientForChain } from "../../config/pimlico";
import type { Address } from "../../types/domain";
import type { SendCheckpoint } from "../../types/job-queue";
import { logger } from "../app/logger";

export interface SendChainReads {
  /**
   * Whether the account has a transaction the network holds but has not mined:
   * its pending nonce is ahead of its mined one. A send whose answer was lost
   * after the network took it may be that transaction.
   */
  hasPendingTransaction?: (account: Address) => Promise<boolean>;
  /**
   * The nonce this transaction used, while the network holds it; null once it
   * does not. The account's next nonce before a prompt is only a floor.
   */
  readTransactionNonce?: (hash: Hex) => Promise<number | null>;
  /**
   * Whether this transaction can never be included because another took its
   * nonce: the account has no code, so the hash is a transaction it signed; the
   * network no longer holds it; and the account's mined nonce has passed the
   * one it was due to use. A Safe's id, or a send from any account with code,
   * never reads as superseded.
   */
  transactionSuperseded?: (hash: Hex, account: Address, nonce: number) => Promise<boolean>;
  /** The chain's latest block and its time, in seconds. */
  readChainHead?: () => Promise<{ number: bigint; timestamp: number }>;
  /**
   * Whether the bundler may still land this UserOperation: every status but one
   * it never held (`not_found`) or refused (`rejected`). A passkey send's
   * pending state lives there, not in the account's nonce.
   */
  userOperationMayLand?: (hash: Hex) => Promise<boolean>;
}

export interface SendChainReadOptions {
  chainId: number;
  getBlock?: typeof wagmiGetBlock;
  getBytecode?: typeof wagmiGetBytecode;
  getTransaction?: typeof wagmiGetTransaction;
  getTransactionCount?: typeof wagmiGetTransactionCount;
  /** The bundler's status for a UserOperation; the default asks the chain's Pimlico bundler. */
  getUserOperationStatus?: (hash: Hex) => Promise<{ status: string }>;
  config?: Config;
}

/**
 * The chain's head just before a work or decision send, to keep with its
 * intent. A read that fails keeps nothing and never stops the send: a lost
 * send is then timed by the device's clock set against the chain's. A
 * commitment act reads its head without this fallback, since it needs the
 * block to tell its own claim from an earlier one.
 */
export async function intentHead(
  readChainHead: SendChainReads["readChainHead"]
): Promise<Pick<SendCheckpoint, "intentBlock" | "intentChainTime"> | undefined> {
  if (!readChainHead) return undefined;
  try {
    const head = await readChainHead();
    return { intentBlock: head.number, intentChainTime: head.timestamp };
  } catch (error) {
    logger.warn("[JobQueue] Could not read the chain's head before a queued send", { error });
    return undefined;
  }
}

/** The chain's latest block time, in seconds, when these reads can tell it. */
export function chainTimeOf(reads: SendChainReads): (() => Promise<number>) | undefined {
  const { readChainHead } = reads;
  return readChainHead && (async () => (await readChainHead()).timestamp);
}

/** Only the node's own "no such transaction" says it no longer holds one. */
function notHeld(error: unknown): boolean {
  return error instanceof Error && error.name === "TransactionNotFoundError";
}

export function createSendChainReads(options: SendChainReadOptions): Required<SendChainReads> {
  const { chainId, config } = options;
  // wagmi and its config are found when a read runs, so building the reads
  // needs neither a configured app nor a connection.
  const wagmiConfig = () => config ?? getWagmiConfig();
  const getBlock = () => options.getBlock ?? wagmiGetBlock;
  const getBytecode = () => options.getBytecode ?? wagmiGetBytecode;
  const getTransaction = () => options.getTransaction ?? wagmiGetTransaction;
  const getTransactionCount = () => options.getTransactionCount ?? wagmiGetTransactionCount;
  const transactionCount = (account: Address, blockTag: "pending" | "latest") =>
    getTransactionCount()(wagmiConfig(), { address: account, blockTag, chainId });
  /** The transaction while the network holds it; null once the node's own "no such transaction" says not. */
  const held = (hash: Hex) =>
    getTransaction()(wagmiConfig(), { hash, chainId }).then(
      (transaction) => transaction,
      (error: unknown) => {
        if (notHeld(error)) return null;
        throw error;
      }
    );

  return {
    readChainHead: async () => {
      const head = await getBlock()(wagmiConfig(), { chainId });
      return { number: head.number, timestamp: Number(head.timestamp) };
    },
    userOperationMayLand: async (hash) => {
      const { status } = await (options.getUserOperationStatus
        ? options.getUserOperationStatus(hash)
        : createPimlicoClientForChain(chainId).getUserOperationStatus({ hash }));
      return status !== "not_found" && status !== "rejected";
    },
    hasPendingTransaction: async (account) => {
      const [pending, mined] = await Promise.all([
        transactionCount(account, "pending"),
        transactionCount(account, "latest"),
      ]);
      return pending > mined;
    },
    readTransactionNonce: async (hash) => (await held(hash))?.nonce ?? null,
    transactionSuperseded: async (hash, account, nonce) => {
      const [code, mined, transaction] = await Promise.all([
        getBytecode()(wagmiConfig(), { address: account, chainId }),
        transactionCount(account, "latest"),
        held(hash),
      ]);
      return (!code || code === "0x") && transaction === null && mined > nonce;
    },
  };
}
