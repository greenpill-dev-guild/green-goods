import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import {
  isGardenHiddenEverywhere,
  UNKNOWN_GARDEN_LOCATION,
  UNNAMED_GARDEN_NAME,
  withoutHiddenGardens,
} from "../../config/garden-visibility";
import type { Address, Garden } from "../../types/domain";
import { logger } from "../app/logger";
import { reconcileGardenDepartures } from "../garden/garden-departures";
import { greenGoodsGraphQL, type ResultOf, type VariablesOf } from "./graphql";
import { greenGoodsIndexer, type GraphQLReader } from "./graphql-client";
import { resolveIPFSUrl } from "./ipfs/resolve";

const GARDENS_QUERY = greenGoodsGraphQL(/* GraphQL */ `
  query Gardens(
    $chainId: Int!
    $scope: Garden_bool_exp! = {}
    $order: [Garden_order_by!]! = [{createdAt: desc}]
  ) {
    Garden(where: {chainId: {_eq: $chainId}, _and: [$scope]}, order_by: $order, limit: 50) {
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
    GardenDomains(where: {chainId: {_eq: $chainId}}) {
      garden
      domainMask
    }
  }
`);

type IndexerGardenRow = ResultOf<typeof GARDENS_QUERY>["Garden"][number];

/** A garden row as the app uses it. Any read that selects the list's fields maps through here. */
function gardenFromRow(garden: IndexerGardenRow, domainMask: number): Garden {
  // DIRTY FIX: Override Octant Community Garden banner until indexer is updated
  const OCTANT_BANNER_OVERRIDE = "bafkreihslrqy363mkr4kn5skr56zcazyvikldosy433p6e5okxyxxjdyuy";
  const isOctantGarden = garden.name === "Octant Community Garden";

  const bannerImage = isOctantGarden
    ? resolveIPFSUrl(OCTANT_BANNER_OVERRIDE)
    : garden.bannerImage
      ? resolveIPFSUrl(garden.bannerImage)
      : "";

  return {
    id: garden.id,
    chainId: garden.chainId,
    tokenAddress: garden.tokenAddress as Address,
    tokenID: BigInt(garden.tokenID),
    name: garden.name || UNNAMED_GARDEN_NAME,
    description: garden.description || "",
    location: garden.location || UNKNOWN_GARDEN_LOCATION,
    bannerImage,
    gardeners: (garden.gardeners || []) as Address[],
    // The indexer field keeps the deployed `operators` wire name.
    stewards: (garden.operators || []) as Address[],
    evaluators: (garden.evaluators || []) as Address[],
    owners: (garden.owners || []) as Address[],
    funders: (garden.funders || []) as Address[],
    communities: (garden.communities || []) as Address[],
    openJoining: Boolean(garden.openJoining),
    domainMask,
    assessments: [],
    works: [],
    createdAt: garden.createdAt ? (garden.createdAt as number) * 1000 : Date.now(),
  };
}

async function readGardenPage(
  reader: GraphQLReader,
  variables: VariablesOf<typeof GARDENS_QUERY>,
  context: string
) {
  const { data, error } = await reader.query(GARDENS_QUERY, variables, context);
  if (error) throw error;
  if (!data || !Array.isArray(data.Garden)) {
    throw new Error("Garden indexer response is missing the garden list");
  }

  // Indexer domain keys are lowercase even when the garden id is checksummed.
  const domainRows = (data.GardenDomains ?? []) as Array<{ garden: string; domainMask: number }>;
  const domains = new Map(
    domainRows.map(({ garden, domainMask }) => [garden.toLowerCase(), domainMask])
  );
  return {
    rows: data.Garden,
    gardens: withoutHiddenGardens(data.Garden).map((garden) =>
      gardenFromRow(garden, domains.get(garden.id.toLowerCase()) ?? 0)
    ),
  };
}

/** Returns the newest gardens with resolved banner assets for the current chain. */
export async function getGardens(reader: GraphQLReader = greenGoodsIndexer): Promise<Garden[]> {
  try {
    const chainId = DEFAULT_CHAIN_ID;
    const { gardens } = await readGardenPage(reader, { chainId }, "getGardens");
    return reconcileGardenDepartures(gardens, chainId);
  } catch (error) {
    logger.error("[getGardens] Failed to fetch gardens", { error });
    throw error;
  }
}

/** Read Profile’s indexed memberships even when they predate the public catalog’s first page. */
export async function getProfileMemberGardens(
  account: Address,
  reader: GraphQLReader = greenGoodsIndexer
): Promise<Garden[]> {
  const chainId = DEFAULT_CHAIN_ID;
  const member = { _contains: [account.toLowerCase()] };
  const gardens: Garden[] = [];
  const cursors = new Set<string>();
  let after = "";
  for (;;) {
    const page = await readGardenPage(
      reader,
      {
        chainId,
        scope: {
          id: { _gt: after },
          _or: [
            { gardeners: member },
            { operators: member },
            { evaluators: member },
            { owners: member },
            { funders: member },
            { communities: member },
          ],
        },
        order: [{ id: "asc" }],
      },
      "getProfileMemberGardens"
    );
    gardens.push(...page.gardens);
    if (page.rows.length < 50) break;
    const next = page.rows[page.rows.length - 1].id;
    if (cursors.has(next) || next === "")
      throw new Error("Garden membership pagination did not advance");
    cursors.add(next);
    after = next;
  }
  gardens.sort((left, right) => right.createdAt - left.createdAt);
  return reconcileGardenDepartures(gardens, chainId);
}

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
