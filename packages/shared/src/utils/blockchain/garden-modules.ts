import { readContract } from "@wagmi/core";
import { getWagmiConfig } from "../../config/appkit";
import { logger } from "../../modules/app/logger";
import type { Address } from "../../types/domain";
import { GARDEN_ACCOUNT_TOKEN_ABI, GARDEN_TOKEN_MODULES_ABI } from "./abis";
import { isZeroAddress } from "./address";

export async function fetchGardensModuleAddress(
  gardenAddress: Address,
  chainId?: number
): Promise<Address | undefined> {
  try {
    const tokenResult = await readContract(getWagmiConfig(), {
      address: gardenAddress,
      abi: GARDEN_ACCOUNT_TOKEN_ABI,
      functionName: "token",
      chainId,
    });

    if (!Array.isArray(tokenResult) || tokenResult.length < 3) {
      logger.error("Unexpected token() return format", { tokenResult });
      return undefined;
    }
    const [, tokenContract] = tokenResult as [bigint, Address, bigint];
    if (!tokenContract || isZeroAddress(tokenContract)) return undefined;

    const moduleAddress = await readContract(getWagmiConfig(), {
      address: tokenContract,
      abi: GARDEN_TOKEN_MODULES_ABI,
      functionName: "gardensModule",
      chainId,
    });

    return isZeroAddress(moduleAddress as Address) ? undefined : (moduleAddress as Address);
  } catch (error) {
    logger.error("Failed to fetch GardensModule address", { error, gardenAddress });
    return undefined;
  }
}
