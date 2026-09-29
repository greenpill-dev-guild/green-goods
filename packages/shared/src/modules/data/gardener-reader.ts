import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import type { Address, GardenerCard } from "../../types/domain";
import { logger } from "../app/logger";
import { greenGoodsGraphQL } from "./graphql";
import { type GraphQLReader, greenGoodsIndexer } from "./graphql-client";

/** Reads first gardener-role assignments across every indexer page. */
export async function getGardeners(
  reader: GraphQLReader = greenGoodsIndexer
): Promise<GardenerCard[]> {
  try {
    const chainId = DEFAULT_CHAIN_ID;
    const pageSize = 200;
    const query = greenGoodsGraphQL(/* GraphQL */ `
      query Gardeners($chainId: Int!, $limit: Int!, $offset: Int!) {
        Gardener(where: {chainId: {_eq: $chainId}}, order_by: {id: asc}, limit: $limit, offset: $offset) {
          id
          chainId
          createdAt
          firstGarden
        }
      }
    `);

    const gardeners: GardenerCard[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await reader.query(
        query,
        { chainId, limit: pageSize, offset },
        "getGardeners"
      );
      if (error) throw error;
      if (!data || !Array.isArray(data.Gardener)) {
        throw new Error("Gardener indexer response is missing the list");
      }

      for (const gardener of data.Gardener) {
        const match = /^(\d+)-(0x[\da-fA-F]{40})$/.exec(gardener.id);
        if (!match || Number(match[1]) !== chainId || gardener.chainId !== chainId) {
          logger.warn("[getGardeners] Skipping invalid gardener identity", {
            id: gardener.id,
            chainId,
          });
          continue;
        }
        const createdAt = Number(gardener.createdAt);
        gardeners.push({
          id: gardener.id,
          account: match[2].toLowerCase() as Address,
          registeredAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt * 1000 : null,
        });
      }
      if (data.Gardener.length < pageSize) break;
    }
    return gardeners;
  } catch (error) {
    logger.error("[getGardeners] Failed to fetch gardeners", { error });
    throw error;
  }
}
