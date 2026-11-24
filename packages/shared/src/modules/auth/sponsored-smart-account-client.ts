import { createSmartAccountClient, type SmartAccountClient } from "permissionless";
import { http } from "viem";
import type { SmartAccount } from "viem/account-abstraction";
import { getChain } from "../../config/chains";
import {
  createPimlicoClientForChain,
  getPimlicoBundlerUrl,
  getPimlicoSponsorshipPolicyId,
} from "../../config/pimlico";

/**
 * The one way a Green Goods smart account sends: Pimlico's bundler, Pimlico's paymaster under
 * the chain's sponsorship policy, and Pimlico's fast gas price. Passkey and email accounts
 * differ only in the owner that signs; the account builds the same client.
 */
export function createSponsoredSmartAccountClient(
  account: SmartAccount,
  chainId: number
): SmartAccountClient {
  const pimlicoClient = createPimlicoClientForChain(chainId);
  return createSmartAccountClient({
    account,
    chain: getChain(chainId),
    bundlerTransport: http(getPimlicoBundlerUrl(chainId)),
    paymaster: pimlicoClient,
    paymasterContext: { sponsorshipPolicyId: getPimlicoSponsorshipPolicyId(chainId) },
    userOperation: {
      estimateFeesPerGas: async () => {
        const { fast } = await pimlicoClient.getUserOperationGasPrice();
        return {
          maxFeePerGas: fast.maxFeePerGas,
          maxPriorityFeePerGas: fast.maxPriorityFeePerGas,
        };
      },
    },
  }) as SmartAccountClient;
}
