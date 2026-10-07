/**
 * Embedded Wallet Transaction Sender
 *
 * Intended to use EIP-5792 sendCalls with paymaster capability for gas
 * sponsorship. Since wagmi experimental APIs (@wagmi/core/experimental) are
 * not available in the current wagmi version, this implementation falls back
 * to standard writeContract from @wagmi/core — meaning transactions are NOT
 * gas-sponsored yet.
 *
 * When EIP-5792 support is available, sendContractCall and sendBatch should
 * use sendCalls() with paymasterService capability and poll with
 * getCallsStatus() for completion.
 *
 * @module modules/transactions/embedded-sender
 */

import {
  signTypedData as defaultSignTypedData,
  ConnectorNotConnectedError,
  getAccount as defaultGetAccount,
  waitForTransactionReceipt as defaultWaitForReceipt,
  writeContract as defaultWriteContract,
  type Config,
} from "@wagmi/core";
import type { Hex } from "viem";
import type { Address } from "../../types/domain";
import { logger } from "../app/logger";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import type { WalletNetworkSwitchReason } from "../app/walletNetworkSwitchAnalytics";
import {
  assertWalletAccount,
  ensureWagmiWalletChain,
  retryOnWalletChainMismatch,
} from "./chain-guard";
import { assertLocalArbitrumForkWallet } from "./local-fork-safety";
import {
  TransactionReplacementError,
  TransactionRevertedError,
  type AccountTypedDataRequest,
  type ContractCall,
  type TransactionSender,
  type TransactionSendOptions,
  type TxResult,
} from "./types";

/** Injectable wagmi functions for testability */
export interface EmbeddedSenderDeps {
  signTypedData?: (config: Config, request: AccountTypedDataRequest) => Promise<Hex>;
  writeContract: (config: Config, params: Record<string, unknown>) => Promise<Hex>;
  waitForTransactionReceipt: (
    config: Config,
    params: {
      hash: Hex;
      chainId?: number;
      onReplaced?: (replacement: { reason: "cancelled" | "replaced" | "repriced" }) => void;
    }
  ) => Promise<{ status: string; transactionHash?: Hex }>;
  getAccount?: () => { address?: Address };
  assertWriteSafety?: () => Promise<void>;
  ensureWalletChain?: (
    chainId: number,
    reason?: WalletNetworkSwitchReason,
    beforeSwitch?: () => void | Promise<void>
  ) => Promise<void>;
}

export class EmbeddedSender implements TransactionSender {
  readonly supportsSponsorship = false;
  readonly supportsBatching = false;
  readonly authMode = "embedded" as const;

  private config: Config;
  private erc7677ProxyUrl: string | undefined;
  private deps: EmbeddedSenderDeps;

  constructor(wagmiConfig: Config, erc7677ProxyUrl?: string, deps?: EmbeddedSenderDeps) {
    this.config = wagmiConfig;
    this.erc7677ProxyUrl = erc7677ProxyUrl;
    this.deps = deps ?? {
      writeContract: defaultWriteContract as unknown as EmbeddedSenderDeps["writeContract"],
      waitForTransactionReceipt:
        defaultWaitForReceipt as unknown as EmbeddedSenderDeps["waitForTransactionReceipt"],
      assertWriteSafety: assertLocalArbitrumForkWallet,
    };
    this.deps.signTypedData ??= (config, request) =>
      defaultSignTypedData(config, { ...request.data, account: request.account } as Parameters<
        typeof defaultSignTypedData
      >[1]);
    this.deps.getAccount ??= () => defaultGetAccount(this.config);
    this.deps.assertWriteSafety ??= assertLocalArbitrumForkWallet;
    this.deps.ensureWalletChain ??= (chainId, reason, beforeSwitch) =>
      ensureWagmiWalletChain(this.config, chainId, reason, beforeSwitch);
  }

  /**
   * The call with the address it is for: the one it names, or else the one
   * connected when its send starts. The send belongs to that address from then
   * on, so a wallet that takes the connection over is asked neither to change
   * network nor to sign it. A send that starts with no wallet connected is for
   * nobody, and is refused here: waiting to see who connects would let that
   * wallet sign it.
   */
  private forSigner(call: ContractCall): ContractCall {
    const account = call.account ?? this.deps.getAccount?.().address;
    if (!account) throw new ConnectorNotConnectedError();
    return { ...call, account };
  }

  /**
   * Who signs: the act's own ownership check, then the account the call is
   * for. The account is read last, with nothing awaited after it.
   */
  private async assertSigner(call: ContractCall, options: TransactionSendOptions): Promise<void> {
    await options.assertOwnership?.();
    if (call.account) assertWalletAccount(call.account, this.deps.getAccount?.().address);
  }

  /**
   * What must hold before the wallet is asked: its network, the fork check, and
   * who signs. The guard asks who signs right before it asks the wallet to
   * change network, so a wallet that took the connection over while the act
   * was being prepared is refused, not switched. Who signs is asked again once
   * the wallet is on the network, because a switch prompt can stay open long
   * enough for the account to change.
   */
  private async readyWallet(
    call: ContractCall,
    chainId: number,
    options: TransactionSendOptions,
    reason: WalletNetworkSwitchReason
  ): Promise<void> {
    await this.deps.ensureWalletChain?.(chainId, reason, () => this.assertSigner(call, options));
    await this.deps.assertWriteSafety?.();
    await this.assertSigner(call, options);
  }

  async signTypedData(
    request: AccountTypedDataRequest,
    options: TransactionSendOptions = {}
  ): Promise<Hex> {
    if (request.data.domain?.chainId !== request.chainId)
      throw new Error("typed-data-chain-mismatch");
    const assertSigner = async () => {
      await options.assertOwnership?.();
      assertWalletAccount(request.account, this.deps.getAccount?.().address);
    };
    await assertSigner();
    await this.deps.ensureWalletChain?.(request.chainId, "write", assertSigner);
    await assertSigner();
    const signature = await this.deps.signTypedData!(this.config, request);
    await assertSigner();
    return signature;
  }

  async sendContractCall(
    named: ContractCall,
    options: TransactionSendOptions = {}
  ): Promise<TxResult> {
    // TODO: Replace with EIP-5792 sendCalls + paymasterService once @wagmi/core/experimental is stable.
    const call = this.forSigner(named);
    const chainId = call.chainId ?? DEFAULT_CHAIN_ID;
    await this.readyWallet(call, chainId, options, "write");
    await options.onBeforeBroadcast?.();

    // The wallet can change network between the guard and the write. viem then
    // refuses before anything is signed, so every check runs again and one more
    // attempt cannot send twice.
    const hash = await retryOnWalletChainMismatch(
      () =>
        this.deps.writeContract(this.config, {
          ...(call.account ? { account: call.account } : {}),
          address: call.address,
          abi: call.abi,
          functionName: call.functionName,
          args: call.args as unknown[],
          chainId,
          ...(call.value !== null && call.value !== undefined ? { value: call.value } : {}),
        }),
      () => this.readyWallet(call, chainId, options, "retry")
    );

    await options.onBroadcastReference?.({ kind: "transaction", hash: hash as `0x${string}` });
    await options.onBroadcast?.(hash as `0x${string}`);

    let invalidReplacement: "cancelled" | "replaced" | undefined;
    const receipt = await this.deps.waitForTransactionReceipt(this.config, {
      hash,
      chainId,
      onReplaced: ({ reason }) => {
        if (reason !== "repriced") invalidReplacement = reason;
      },
    });
    if (invalidReplacement) throw new TransactionReplacementError(invalidReplacement);
    if (receipt.status === "reverted") {
      throw new TransactionRevertedError(hash, "Transaction reverted on-chain");
    }

    const confirmedHash = receipt.transactionHash ?? hash;
    logger.debug("Embedded transaction sent", {
      source: "EmbeddedSender",
      functionName: call.functionName,
      address: call.address,
      hash: confirmedHash,
      erc7677ProxyUrl: this.erc7677ProxyUrl,
    });

    return { hash: confirmedHash, sponsored: false };
  }

  async sendBatch(calls: ContractCall[]): Promise<TxResult> {
    if (calls.length === 0) {
      throw new Error("Cannot send empty batch");
    }

    // TODO: Use EIP-5792 sendCalls for atomic batching when available.
    // For now, send calls sequentially.
    let lastResult: TxResult | null = null;
    for (const call of calls) {
      lastResult = await this.sendContractCall(call);
    }

    return lastResult!;
  }
}
