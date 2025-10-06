import { type Hex, keccak256, toHex } from "viem";
import { getPimlicoPaymasterUrl } from "./config";

// Garden joining function signatures
const JOIN_GARDEN_SELECTOR = "0x" + keccak256(toHex("joinGarden()")).slice(2, 10);
const JOIN_GARDEN_WITH_INVITE_SELECTOR =
  "0x" + keccak256(toHex("joinGardenWithInvite(bytes32)")).slice(2, 10);

/**
 * Validates if a user operation should be sponsored by the paymaster
 * @param callData The call data from the user operation
 * @param chainId The chain ID
 * @returns true if the operation should be sponsored
 */
export function shouldSponsorOperation(callData: Hex, _chainId: number): boolean {
  const selector = callData.slice(0, 10) as Hex;

  // Sponsor both open garden joins and invite-based joins
  if (selector === JOIN_GARDEN_SELECTOR || selector === JOIN_GARDEN_WITH_INVITE_SELECTOR) {
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
  sponsorshipPolicyId?: string; // Optional sponsorship policy ID from Pimlico dashboard
}

/**
 * Gets paymaster data for a user operation
 */
export async function getPaymasterData(
  userOperation: any,
  config: PaymasterConfig
): Promise<{ paymasterAndData: Hex }> {
  const { chainId, sponsorshipPolicyId } = config;
  const paymasterUrl = getPimlicoPaymasterUrl(chainId);

  try {
    // Validate that we should sponsor this operation
    if (!shouldSponsorOperation(userOperation.callData, chainId)) {
      throw new Error("Operation not eligible for sponsorship");
    }

    // Call Pimlico paymaster API
    const response = await fetch(paymasterUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "pm_sponsorUserOperation",
        params: [
          userOperation,
          {
            entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032", // EntryPoint v0.7
            sponsorshipPolicyId: sponsorshipPolicyId || undefined,
          },
        ],
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Paymaster error: ${data.error.message}`);
    }

    return {
      paymasterAndData: data.result.paymasterAndData,
    };
  } catch (error) {
    console.error("[Paymaster] Failed to get paymaster data:", error);
    throw error;
  }
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
