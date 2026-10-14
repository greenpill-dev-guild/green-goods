import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { isGardenHiddenEverywhere } from "../../config/garden-visibility";
import type { Address, Garden } from "../../types/domain";
import { logger } from "../app/logger";
import { gardenFromRow } from "./greengoods";
import { greenGoodsGraphQL } from "./graphql";
import { greenGoodsIndexer, type GraphQLReader } from "./graphql-client";

/** One garden by id, selecting what the garden list selects, so its row maps the same way. */
const GARDEN_QUERY = greenGoodsGraphQL(/* GraphQL */ `
  query Garden($chainId: Int!, $id: String!) {
    Garden(where: {chainId: {_eq: $chainId}, id: {_ilike: $id}}, limit: 1) {
      id
      chainId
      tokenAddress
      tokenID
      name
      description
      location
      bannerImage
      gardeners
      operators
      evaluators
      owners
      funders
      communities
      openJoining
      createdAt
    }
    GardenDomains(where: {chainId: {_eq: $chainId}, garden: {_ilike: $id}}) {
      garden
      domainMask
    }
  }
`);

/**
 * One garden's own record on the current chain, or null when the indexer holds
 * none. The garden list (`getGardens`) holds a chain's newest 50 only; this
 * reads a garden past them, such as the chain's first, the protocol garden. A
 * failed read throws, as the list's does.
 */
export async function getGarden(
  gardenId: Address,
  reader: GraphQLReader = greenGoodsIndexer
): Promise<Garden | null> {
  try {
    const chainId = DEFAULT_CHAIN_ID;
    const { data, error } = await reader.query(
      GARDEN_QUERY,
      { chainId, id: gardenId },
      "getGarden"
    );

    if (error) throw error;

    if (!data || !Array.isArray(data.Garden)) {
      throw new Error("Garden indexer response is missing the garden");
    }

    const garden = data.Garden[0];
    if (!garden || isGardenHiddenEverywhere(garden.id)) return null;
    const domains = (data.GardenDomains ?? []) as Array<{ garden: string; domainMask: number }>;
    return gardenFromRow(garden, domains[0]?.domainMask ?? 0);
  } catch (error) {
    logger.error("[getGarden] Failed to fetch the garden", { error });
    throw error;
  }
}
