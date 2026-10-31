import { type Config, getBlock } from "@wagmi/core";

/**
 * How far the chain's clock runs ahead of this device's, in milliseconds: the latest block's
 * timestamp against the device's time as it arrived. `useExpiryClock` loads this module only when
 * it reads, so the read stays off the startup bundle, and it names `getBlock`, so the Shared
 * mutation analyzer reads it as the read it is.
 */
export async function readChainClockOffsetMs(config: Config, chainId: number): Promise<number> {
  const block = await getBlock(config, { chainId });
  return Number(block.timestamp) * 1000 - Date.now();
}
