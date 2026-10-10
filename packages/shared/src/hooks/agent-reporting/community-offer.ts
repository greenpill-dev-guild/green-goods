import { getDefaultChain } from "../../config/blockchain";
import { getGarden } from "../../modules/data/indexer-garden";
import type { Address } from "../../types/domain";
import { simulateJoinGarden } from "../../utils/blockchain/simulation";

/** The garden open to all, which an account the chain would let in is invited to join. */
export interface CommunityOffer {
  address: Address;
  name: string;
  chainId: number;
}

/** Linking waits on this read, so it is given a few seconds and no more. */
const READ_TIMEOUT_MS = 6_000;

async function eligibleOffer(account: Address, community: Address, chainId: number) {
  // The indexer only names the garden. It is read on its own: the garden list holds a chain's
  // newest gardens only, and this is its first. Whether the garden takes this account is the
  // chain's answer to the join itself.
  const [garden, join] = await Promise.all([
    getGarden(community),
    simulateJoinGarden(community, account, undefined, chainId),
  ]);
  return garden && join.success ? { address: community, name: garden.name, chainId } : null;
}

/**
 * Whether the account a chat links is offered the Community Garden: the chain would accept its
 * join now. That refuses a garden closed to joining or full, and an account already a gardener
 * there. Its other gardens do not count, so an account that reports elsewhere can still join
 * this one. It is read for the account the challenge proved, which need not be the one this
 * browser has connected. A read that fails or runs long means no offer, so the link step is
 * never held up for more than a few seconds.
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
