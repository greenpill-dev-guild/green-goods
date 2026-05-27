/**
 * Register in Signal Pool Service
 *
 * XState actor that registers a newly minted hypercert in the garden's
 * HypercertSignalPool contract.
 *
 * @module hooks/hypercerts/services/register-in-signal-pool
 */

import { encodeFunctionData } from "viem";
import { fromPromise } from "xstate";

import { createPublicClientForChain } from "../../../config";
import { getChain } from "../../../config/chains";
import { logger } from "../../../modules/app/logger";
import {
  assertLocalArbitrumForkSmartAccountsDisabled,
  assertLocalArbitrumForkWallet,
} from "../../../modules/transactions/local-fork-safety";
import { ensureAppKitWalletChain } from "../../../modules/transactions/chain-guard";
import type { Address } from "../../../types/domain";
import { isZeroAddress } from "../../../utils/blockchain/address";
import { GARDENS_MODULE_ABI, HYPERCERT_SIGNAL_POOL_ABI } from "../../../utils/blockchain/abis";
import { getNetworkContracts } from "../../../utils/blockchain/contracts";
import type { RegisterInSignalPoolInput } from "../../../workflows/mintHypercert";
import { RECEIPT_POLLING_TIMEOUT_MS, withTimeout } from "../hypercert-utils";
import type { MintServiceDeps } from "./types";

/**
 * Creates the registerInSignalPool actor for the mint hypercert machine.
 *
 * Looks up the garden's HypercertSignalPool, then sends a registerHypercert
 * transaction. Gracefully returns { registered: false } when no pool exists.
 */
export function createRegisterInSignalPoolActor(deps: MintServiceDeps) {
  return fromPromise(async ({ input }: { input: RegisterInSignalPoolInput }) => {
    const currentSmartAccountClient = deps.smartAccountClientRef.current;
    const currentWalletClient = deps.walletClientRef.current;
    const currentEoaAddress = deps.eoaAddressRef.current;
    const currentChainId = deps.chainIdRef.current;

    const { gardenAddress, hypercertId } = input;

    if (!hypercertId) {
      logger.warn("[useMintHypercert] No hypercertId, skipping pool registration");
      return { registered: false, poolAddress: null };
    }

    // Resolve GardensModule address from deployment config
    const contracts = getNetworkContracts(currentChainId);
    const gardensModuleAddr = contracts.gardensModule;

    if (!gardensModuleAddr || isZeroAddress(gardensModuleAddr)) {
      logger.info("[useMintHypercert] No GardensModule deployed, skipping pool registration", {
        chainId: currentChainId,
      });
      return { registered: false, poolAddress: null };
    }

    const publicClient = createPublicClientForChain(currentChainId);

    const hypercertPoolAddress = (await publicClient.readContract({
      address: gardensModuleAddr,
      abi: GARDENS_MODULE_ABI,
      functionName: "gardenHypercertSignalPools",
      args: [gardenAddress],
    })) as Address;

    if (!hypercertPoolAddress || isZeroAddress(hypercertPoolAddress)) {
      logger.info("[useMintHypercert] No HypercertSignal pool for garden, skipping registration", {
        gardenAddress,
        chainId: currentChainId,
      });
      return { registered: false, poolAddress: null };
    }

    const hypercertIdBigInt = BigInt(hypercertId);

    logger.info("[useMintHypercert] Registering hypercert in signal pool", {
      hypercertId,
      poolAddress: hypercertPoolAddress,
      gardenAddress,
    });

    // Send registration transaction
    if (currentSmartAccountClient) {
      assertLocalArbitrumForkSmartAccountsDisabled();

      const regOpHash = await currentSmartAccountClient.sendUserOperation({
        account: currentSmartAccountClient.account,
        calls: [
          {
            to: hypercertPoolAddress,
            data: encodeFunctionData({
              abi: HYPERCERT_SIGNAL_POOL_ABI,
              functionName: "registerHypercert",
              args: [hypercertIdBigInt],
            }),
            value: 0n,
          },
        ],
      });

      // Wait for registration confirmation
      await withTimeout(
        currentSmartAccountClient.getUserOperationReceipt({ hash: regOpHash }),
        RECEIPT_POLLING_TIMEOUT_MS,
        "Signal pool registration"
      );
    } else if (currentWalletClient && currentEoaAddress) {
      await ensureAppKitWalletChain(currentChainId);
      await assertLocalArbitrumForkWallet();

      const regTxHash = await currentWalletClient.writeContract({
        address: hypercertPoolAddress,
        abi: HYPERCERT_SIGNAL_POOL_ABI,
        functionName: "registerHypercert",
        args: [hypercertIdBigInt],
        account: currentEoaAddress as Address,
        chain: getChain(currentChainId),
      });

      await withTimeout(
        publicClient.waitForTransactionReceipt({ hash: regTxHash }),
        RECEIPT_POLLING_TIMEOUT_MS,
        "Signal pool registration"
      );
    } else {
      logger.warn("[useMintHypercert] No wallet available for pool registration");
      return { registered: false, poolAddress: hypercertPoolAddress };
    }

    logger.info("[useMintHypercert] Hypercert registered in signal pool", {
      hypercertId,
      poolAddress: hypercertPoolAddress,
      gardenAddress,
    });

    return { registered: true, poolAddress: hypercertPoolAddress };
  });
}
