import { readContract } from "@wagmi/core";
import { getWagmiConfig } from "../../config/appkit";
import { getDefaultChain } from "../../config/blockchain";
import { getGardens } from "../../modules/data/greengoods";
import type { Address } from "../../types/domain";
import { GardenAccountABI } from "../../utils/blockchain/contracts";

/** The garden an account in no garden is invited to join while it links its chat. */
export interface CommunityOffer {
  address: Address;
  name: string;
  chainId: number;
}

/** Linking waits on this read, so it is given a few seconds and no more. */
const READ_TIMEOUT_MS = 6_000;

async function eligibleOffer(account: Address, community: Address, chainId: number) {
  const gardens = await getGardens();
  const member = account.toLowerCase();
  const belongs = gardens.some((garden) =>
    [...garden.gardeners, ...garden.stewards, ...garden.owners].some(
      (address) => address.toLowerCase() === member
    )
  );
  if (belongs) return null;
  const garden = gardens.find((item) => item.id.toLowerCase() === community.toLowerCase());
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
 * Whether the account a chat links is offered the Community Garden: the indexer shows it in no
 * garden, the garden is open to join, and the chain says it is not a member yet. It is read for
 * the account the challenge proved, which need not be the one this browser has connected. A read
 * that fails or runs long means no offer, so the link step is never held up for more than a few
 * seconds.
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
