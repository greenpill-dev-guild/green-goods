import { readContract } from "@wagmi/core";
import type { Address } from "viem";
import { wagmiConfig } from "../../config/appkit";
import { isZeroAddress } from "./address";
import { GARDEN_ACCOUNT_TOKEN_ABI, GARDEN_TOKEN_MODULES_ABI } from "./abis";

export async function fetchGardenHatsModuleAddress(
  gardenAddress: Address,
  chainId?: number
): Promise<Address | undefined> {
  try {
    const tokenResult = await readContract(wagmiConfig, {
      address: gardenAddress,
      abi: GARDEN_ACCOUNT_TOKEN_ABI,
      functionName: "token",
      chainId,
    });

    const [, tokenContract] = tokenResult as unknown as [bigint, Address, bigint];
    if (!tokenContract || isZeroAddress(tokenContract)) return undefined;

    const moduleAddress = await readContract(wagmiConfig, {
      address: tokenContract,
      abi: GARDEN_TOKEN_MODULES_ABI,
      functionName: "gardenHatsModule",
      chainId,
    });

    return isZeroAddress(moduleAddress as Address) ? undefined : (moduleAddress as Address);
  } catch {
    return undefined;
  }
}
