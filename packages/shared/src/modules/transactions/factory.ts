/**
 * TransactionSender Factory
 *
 * Creates the appropriate TransactionSender implementation based on
 * the current auth mode and available clients/configuration.
 *
 * @module modules/transactions/factory
 */

import type { Address } from "../../types/domain";
import type { SmartAccountClientResolver } from "../../types/auth";
import type { SmartAccountClient } from "permissionless";
import type { Config } from "@wagmi/core";
import type { TransactionSender } from "./types";
import { PasskeySender } from "./passkey-sender";
import { EmbeddedSender } from "./embedded-sender";
import { WalletSender } from "./wallet-sender";

export interface TransactionSenderOptions {
  authMode: "passkey" | "embedded" | "wallet";
  smartAccountClient?: SmartAccountClient | null;
  resolveSmartAccountClient?: SmartAccountClientResolver | null;
  wagmiConfig?: Config;
  writeContractAsync?: (params: {
    address: `0x${string}`;
    account?: Address;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
    chainId?: number;
    value?: bigint;
  }) => Promise<`0x${string}`>;
  erc7677ProxyUrl?: string;
}

/**
 * Create a TransactionSender for the given auth mode.
 *
 * @throws {Error} If required dependencies are missing for the specified auth mode.
 *
 * @example
 * ```typescript
 * const sender = createTransactionSender({
 *   authMode: "passkey",
 *   smartAccountClient,
 * });
 * const result = await sender.sendContractCall({
 *   address: "0x...",
 *   abi: [...],
 *   functionName: "transfer",
 *   args: [to, amount],
 * });
 * ```
 */
export function createTransactionSender(options: TransactionSenderOptions): TransactionSender {
  switch (options.authMode) {
    case "passkey": {
      if (options.smartAccountClient?.account) {
        return new PasskeySender(options.smartAccountClient, {
          resolveSmartAccountClient: options.resolveSmartAccountClient,
        });
      }
      throw new Error("smartAccountClient is required for passkey auth mode");
    }

    case "embedded": {
      if (!options.wagmiConfig) {
        throw new Error("wagmiConfig is required for embedded auth mode");
      }
      return new EmbeddedSender(options.wagmiConfig, options.erc7677ProxyUrl);
    }

    case "wallet": {
      if (!options.wagmiConfig) {
        throw new Error("wagmiConfig is required for wallet auth mode");
      }
      if (!options.writeContractAsync) {
        throw new Error("writeContractAsync is required for wallet auth mode");
      }
      return new WalletSender(
        options.wagmiConfig,
        options.writeContractAsync,
        options.erc7677ProxyUrl
      );
    }
  }
}
