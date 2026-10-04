import { readContract } from "@wagmi/core";
import { getWagmiConfig } from "../../config/appkit";
import { getDefaultChain } from "../../config/blockchain";
import { getGarden } from "../../modules/data/indexer-garden";
import type { Address } from "../../types/domain";
import { GardenAccountABI } from "../../utils/blockchain/contracts";

/** The garden open to all, which an account not yet in it is invited to join from its chat link. */
export interface CommunityOffer {
  address: Address;
  name: string;
  chainId: number;
}

/** Linking waits on this read, so it is given a few seconds and no more. */
const READ_TIMEOUT_MS = 6_000;

async function eligibleOffer(account: Address, community: Address, chainId: number) {
  // Read on its own: the garden list holds a chain's newest gardens only, and this is its first.
  const garden = await getGarden(community);
  if (!garden?.openJoining) return null;
  const isGardener = await readContract(getWagmiConfig(), {
    address: community,
    abi: GardenAccountABI,
    functionName: "isGardener",
    args: [account],
    chainId,
  });
  return isGardener ? null : { address: community, name: garden.name, chainId };
}

/**
 * Whether the account a chat links is offered the Community Garden: the garden is open to join
 * and the chain says the account is not a gardener there yet. Its other gardens do not count, so
 * an account that reports elsewhere can still join this one. It is read for the account the
 * challenge proved, which need not be the one this browser has connected. A read that fails or
 * runs long means no offer, so the link step is never held up for more than a few seconds.
 */
export async function readCommunityOffer(account: Address): Promise<CommunityOffer | null> {
  const chain = getDefaultChain();
  const community = chain.rootGarden?.address;
  if (!community) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const lapsed = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), READ_TIMEOUT_MS);
  });
  try {
    return await Promise.race([eligibleOffer(account, community, chain.chainId), lapsed]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
