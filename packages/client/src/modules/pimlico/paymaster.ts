import { type Hex, keccak256, toHex } from "viem";
import type { PimlicoClient } from "permissionless/clients/pimlico";
import {
  entryPoint07Address,
  type GetPaymasterStubDataParameters,
  type GetPaymasterStubDataReturnType,
} from "viem/account-abstraction";

// Garden joining function signature
const JOIN_GARDEN_SELECTOR = "0x" + keccak256(toHex("joinGarden()")).slice(2, 10);

/**
 * Validates if a user operation should be sponsored by the paymaster
 * @param callData The call data from the user operation
 * @param chainId The chain ID
 * @returns true if the operation should be sponsored
 */
export function shouldSponsorOperation(callData: Hex | undefined, _chainId: number): boolean {
  if (!callData || callData === "0x") {
    return false;
  }

  const selector = callData.slice(0, 10) as Hex;

  // Sponsor direct garden joins (no invite system)
  if (selector === JOIN_GARDEN_SELECTOR) {
    return true;
  }

  console.log("[Paymaster] Not sponsoring: unsupported function selector");
  return false;
}

/**
 * Configuration for the Pimlico paymaster
 */
export interface PaymasterConfig {
  chainId: number;
  pimlicoClient: PimlicoClient;
  sponsorshipPolicyId?: string; // Optional sponsorship policy ID from Pimlico dashboard
  sponsorName?: string;
  sponsorIcon?: string;
}

type SponsoredPaymasterReturn = GetPaymasterStubDataReturnType & {
  callGasLimit: bigint;
  preVerificationGas: bigint;
  verificationGasLimit: bigint;
};

const DEFAULT_SPONSOR_NAME = "Pimlico";

/**
 * Requests Pimlico to sponsor the provided user operation and
 * returns the paymaster data in the format expected by permissionless.
 */
export async function requestSponsoredPaymasterData(
  userOperation: GetPaymasterStubDataParameters,
  config: PaymasterConfig
): Promise<SponsoredPaymasterReturn> {
  const { chainId, pimlicoClient, sponsorshipPolicyId, sponsorIcon, sponsorName } = config;

  if (!shouldSponsorOperation(userOperation.callData as Hex, chainId)) {
    throw new Error("Operation not eligible for sponsorship");
  }

  if (isRateLimited(userOperation.sender)) {
    throw new Error("Passkey sponsorship temporarily rate limited. Please try again later.");
  }

  const { context: _context, ...operation } = userOperation as GetPaymasterStubDataParameters & {
    context?: unknown;
  };

  const sponsorship = await pimlicoClient.sponsorUserOperation({
    userOperation: operation,
    entryPoint: {
      address: entryPoint07Address,
      version: "0.7",
    },
    sponsorshipPolicyId,
  });

  recordSponsoredOperation(userOperation.sender);

  return {
    callGasLimit: sponsorship.callGasLimit,
    preVerificationGas: sponsorship.preVerificationGas,
    verificationGasLimit: sponsorship.verificationGasLimit,
    paymaster: sponsorship.paymaster,
    paymasterData: sponsorship.paymasterData,
    paymasterVerificationGasLimit: sponsorship.paymasterVerificationGasLimit,
    paymasterPostOpGasLimit: sponsorship.paymasterPostOpGasLimit,
    isFinal: true,
    sponsor: {
      name: sponsorName ?? DEFAULT_SPONSOR_NAME,
      ...(sponsorIcon ? { icon: sponsorIcon } : {}),
    },
  } satisfies SponsoredPaymasterReturn;
}

/**
 * Rate limiting cache for preventing abuse
 */
const rateLimitCache = new Map<string, number>();
const RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Checks if an address has exceeded rate limits
 * @param address User address
 * @returns true if rate limit is exceeded
 */
export function isRateLimited(address: string): boolean {
  const key = address.toLowerCase();
  const lastUse = rateLimitCache.get(key);

  if (!lastUse) {
    return false;
  }

  const timeSinceLastUse = Date.now() - lastUse;
  return timeSinceLastUse < RATE_LIMIT_WINDOW;
}

/**
 * Records a sponsored operation for rate limiting
 * @param address User address
 */
export function recordSponsoredOperation(address: string): void {
  const key = address.toLowerCase();
  rateLimitCache.set(key, Date.now());
}
