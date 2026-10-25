/**
 * Green Goods names for a list of people, read together. A list's rows ask for their names in
 * the same task, and the reads go out as one L2 multicall of every row's slug, then, for the
 * rows without one, one read of the L1 receiver and one L1 multicall. Each row gets its
 * `*.greengoods.eth` name or null, or the error its own read met, so a row keeps its last
 * known name exactly as a single read does (`useGreenGoodsEnsName`).
 *
 * @module modules/ens/protocol-names
 */

import type { Address } from "viem";

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import {
  createENSL1Client,
  ENS_RECEIVER_OWNER_TO_SLUG_ABI,
  getENSL1ChainId,
  readENSL1ReceiverAddress,
} from "../../hooks/ens/availability";
import { createClients, GreenGoodsENSABI } from "../../utils/blockchain/contracts";
import { logger } from "../app/logger";

interface ListedNameRead {
  owner: Address;
  resolve: (name: string | null) => void;
  reject: (error: unknown) => void;
}

type NameOutcome = PromiseSettledResult<string | null>;

/** The reads asked for in the current task, by Green Goods ENS contract. */
const pendingReads = new Map<Address, ListedNameRead[]>();

function nameFromSlug(slug: unknown): string | null {
  return typeof slug === "string" && slug ? `${slug}.greengoods.eth` : null;
}

async function readNames(
  ensAddress: Address,
  owners: Address[]
): Promise<Map<Address, NameOutcome>> {
  const outcomes = new Map<Address, NameOutcome>();
  const { publicClient } = createClients(DEFAULT_CHAIN_ID);
  const slugs = await publicClient.multicall({
    allowFailure: true,
    contracts: owners.map((owner) => ({
      address: ensAddress,
      abi: GreenGoodsENSABI,
      functionName: "ownerToSlug",
      args: [owner],
    })),
  });

  const misses: Address[] = [];
  owners.forEach((owner, index) => {
    const slug = slugs[index];
    if (slug.status === "failure") {
      outcomes.set(owner, { status: "rejected", reason: slug.error });
      return;
    }
    const name = nameFromSlug(slug.result);
    if (name) outcomes.set(owner, { status: "fulfilled", value: name });
    else misses.push(owner);
  });
  if (misses.length === 0) return outcomes;

  // As a single read does, someone with no L2 slug is looked up on the L1 receiver.
  const settleMisses = (outcome: NameOutcome) => {
    for (const owner of misses) outcomes.set(owner, outcome);
  };
  const l1ChainId = getENSL1ChainId(DEFAULT_CHAIN_ID);
  if (!l1ChainId) {
    settleMisses({ status: "fulfilled", value: null });
    return outcomes;
  }
  try {
    const receiver = await readENSL1ReceiverAddress({ ensAddress, publicClient });
    if (!receiver) {
      settleMisses({ status: "fulfilled", value: null });
      return outcomes;
    }
    const l1Client = l1ChainId === DEFAULT_CHAIN_ID ? publicClient : createENSL1Client(l1ChainId);
    const l1Slugs = await l1Client.multicall({
      allowFailure: true,
      contracts: misses.map((owner) => ({
        address: receiver,
        abi: ENS_RECEIVER_OWNER_TO_SLUG_ABI,
        functionName: "ownerToSlug",
        args: [owner],
      })),
    });
    misses.forEach((owner, index) => {
      const slug = l1Slugs[index];
      outcomes.set(
        owner,
        slug.status === "failure"
          ? { status: "rejected", reason: slug.error }
          : { status: "fulfilled", value: nameFromSlug(slug.result) }
      );
    });
    const failed = l1Slugs.filter((slug) => slug.status === "failure");
    if (failed.length > 0) {
      logger.warn("L1 Green Goods ENS name lookup failed", {
        error: failed[0].error,
        owners: failed.length,
        chainId: DEFAULT_CHAIN_ID,
      });
    }
  } catch (error) {
    logger.warn("L1 Green Goods ENS name lookup failed", {
      error,
      owners: misses.length,
      chainId: DEFAULT_CHAIN_ID,
    });
    settleMisses({ status: "rejected", reason: error });
  }
  return outcomes;
}

async function flushReads(ensAddress: Address): Promise<void> {
  const reads = pendingReads.get(ensAddress) ?? [];
  pendingReads.delete(ensAddress);
  if (reads.length === 0) return;
  let outcomes: Map<Address, NameOutcome>;
  try {
    outcomes = await readNames(ensAddress, [...new Set(reads.map((read) => read.owner))]);
  } catch (error) {
    for (const read of reads) read.reject(error);
    return;
  }
  for (const read of reads) {
    const outcome = outcomes.get(read.owner);
    if (outcome?.status === "fulfilled") read.resolve(outcome.value);
    else read.reject(outcome?.reason ?? new Error("Green Goods name was not read"));
  }
}

/**
 * One row's Green Goods name in a list of people. Every row of a list asks in the same render,
 * so the reads made in one task go out together.
 */
export function readListedProtocolName(
  ensAddress: Address,
  owner: Address
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const read = { owner, resolve, reject };
    const reads = pendingReads.get(ensAddress);
    if (reads) {
      reads.push(read);
      return;
    }
    pendingReads.set(ensAddress, [read]);
    setTimeout(() => void flushReads(ensAddress), 0);
  });
}
