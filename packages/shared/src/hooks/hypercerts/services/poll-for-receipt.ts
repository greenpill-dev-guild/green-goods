/**
 * Poll for Receipt Service
 *
 * XState actor that waits for a transaction receipt (UserOp or direct tx)
 * and extracts the minted hypercert ID from the logs.
 *
 * @module hooks/hypercerts/services/poll-for-receipt
 */

import type { Hex } from "viem";
import { fromPromise } from "xstate";

import { createPublicClientForChain } from "../../../config";
import { logger } from "../../../modules/app/logger";
import type { Address } from "../../../types/domain";
import type { MintHypercertReceiptInput } from "../../../workflows/mintHypercert";
import { resolveHypercertContracts } from "../hypercert-contracts";
import {
  extractHypercertIdFromLogs,
  RECEIPT_POLLING_TIMEOUT_MS,
  withTimeout,
} from "../hypercert-utils";
import type { MintServiceDeps } from "./types";

/**
 * Creates the pollForReceipt actor for the mint hypercert machine.
 *
 * Waits for a UserOp receipt (smart account) or a transaction receipt (EOA),
 * then extracts the hypercert ID from the ERC1155 TransferSingle logs.
 */
export function createPollForReceiptActor(deps: MintServiceDeps) {
  return fromPromise(async ({ input }: { input: MintHypercertReceiptInput }) => {
    const currentSmartAccountClient = deps.smartAccountClientRef.current;
    const currentChainId = deps.chainIdRef.current;

    const contracts = await resolveHypercertContracts(currentChainId);
    const publicClient = createPublicClientForChain(currentChainId);

    if (currentSmartAccountClient) {
      const receipt = await withTimeout(
        currentSmartAccountClient.getUserOperationReceipt({
          hash: input.hash,
        }),
        RECEIPT_POLLING_TIMEOUT_MS,
        "Transaction confirmation"
      );

      const txHash = receipt.receipt.transactionHash as Hex;
      const hypercertId = extractHypercertIdFromLogs(
        receipt.logs.filter(
          (log) => log.address.toLowerCase() === contracts.hypercertMinter.toLowerCase()
        ) as Array<{ address: Address } & Record<string, unknown>>,
        currentChainId
      );

      if (hypercertId === null) {
        logger.warn("[useMintHypercert] Failed to extract hypercertId from logs", {
          txHash,
          logsCount: receipt.logs.length,
        });
        throw new Error(
          "Failed to extract hypercert ID from transaction logs. The mint transaction succeeded but the hypercert ID could not be determined."
        );
      }

      return {
        txHash,
        hypercertId,
      };
    }

    const receipt = await withTimeout(
      publicClient.waitForTransactionReceipt({ hash: input.hash }),
      RECEIPT_POLLING_TIMEOUT_MS,
      "Transaction confirmation"
    );
    const hypercertId = extractHypercertIdFromLogs(
      receipt.logs.filter(
        (log) => log.address.toLowerCase() === contracts.hypercertMinter.toLowerCase()
      ) as Array<{ address: Address } & Record<string, unknown>>,
      currentChainId
    );

    if (hypercertId === null) {
      logger.warn("[useMintHypercert] Failed to extract hypercertId from logs", {
        txHash: receipt.transactionHash,
        logsCount: receipt.logs.length,
      });
      throw new Error(
        "Failed to extract hypercert ID from transaction logs. The mint transaction succeeded but the hypercert ID could not be determined."
      );
    }

    return {
      txHash: receipt.transactionHash,
      hypercertId,
    };
  });
}
