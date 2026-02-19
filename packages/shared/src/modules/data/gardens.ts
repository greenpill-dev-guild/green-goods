import { gql } from "graphql-request";

import { getGardensSubgraphUrl } from "../../config/gardens-subgraph";
import type { Address } from "../../types/domain";
import type { ConvictionWeight, MemberPower, VoterAllocation } from "../../types/conviction";
import {
  WeightScheme,
  PoolType,
  type GardenCommunity,
  type GardenSignalPool,
} from "../../types/gardens-community";
import { logger } from "../app/logger";
import { GQLClient } from "./graphql-client";

// ---------------------------------------------------------------------------
// Client cache (one per chain)
// ---------------------------------------------------------------------------

const clientCache = new Map<number, GQLClient>();

function getClient(chainId: number): GQLClient {
  let client = clientCache.get(chainId);
  if (!client) {
    client = new GQLClient(getGardensSubgraphUrl(chainId));
    clientCache.set(chainId, client);
  }
  return client;
}

// ---------------------------------------------------------------------------
// GraphQL Fragments & Queries
// ---------------------------------------------------------------------------

const STRATEGY_FIELDS = gql`
  fragment StrategyFields on CVStrategy {
    id
    poolId
    totalEffectiveActivePoints
    maxCVSupply
    isEnabled
    config {
      decay
      maxRatio
      weight
      minThresholdPoints
      pointSystem
    }
    registryCommunity {
      id
      communityName
      registerStakeAmount
      registerToken
      membersCount
      garden {
        id
      }
    }
  }
`;

const PROPOSAL_FIELDS = gql`
  fragment ProposalFields on CVProposal {
    id
    proposalNumber
    stakedAmount
    convictionLast
    blockLast
    proposalStatus
  }
`;

// ---------------------------------------------------------------------------
// Query: Garden Community
// ---------------------------------------------------------------------------

const GARDEN_COMMUNITY_QUERY = gql`
  ${STRATEGY_FIELDS}
  query GardenCommunity($communityAddress: ID!) {
    registryCommunity(id: $communityAddress) {
      id
      communityName
      registerStakeAmount
      registerToken
      membersCount
      garden {
        id
      }
      strategies {
        ...StrategyFields
      }
    }
  }
`;

interface RegistryCommunityResponse {
  registryCommunity: {
    id: string;
    communityName: string;
    registerStakeAmount: string;
    registerToken: string;
    membersCount: number;
    garden: { id: string } | null;
    strategies: StrategyNode[];
  } | null;
}

interface StrategyNode {
  id: string;
  poolId: string;
  totalEffectiveActivePoints: string;
  maxCVSupply: string;
  isEnabled: boolean;
  config: {
    decay: string;
    maxRatio: string;
    weight: string;
    minThresholdPoints: string;
    pointSystem: number;
  };
  registryCommunity: {
    id: string;
    communityName: string;
    registerStakeAmount: string;
    registerToken: string;
    membersCount: number;
    garden: { id: string } | null;
  };
}

/**
 * Fetches a garden's RegistryCommunity from the Gardens V2 subgraph.
 * Returns the community data matching the GardenCommunity type.
 */
export async function getGardenCommunityFromSubgraph(
  communityAddress: Address,
  gardenAddress: Address,
  chainId: number
): Promise<GardenCommunity | null> {
  const client = getClient(chainId);

  const { data, error } = await client.query<RegistryCommunityResponse>(
    GARDEN_COMMUNITY_QUERY,
    { communityAddress: communityAddress.toLowerCase() },
    "getGardenCommunity"
  );

  if (error) {
    logger.error("[gardens] Failed to fetch garden community", {
      error: error.message,
      communityAddress,
      chainId,
    });
    return null;
  }

  const community = data?.registryCommunity;
  if (!community) return null;

  return {
    gardenAddress,
    communityAddress: community.id as Address,
    goodsTokenAddress: community.registerToken as Address,
    // WeightScheme is not in the subgraph -- default to Linear; caller can override
    weightScheme: WeightScheme.Linear,
    stakeAmount: BigInt(community.registerStakeAmount),
  };
}

// ---------------------------------------------------------------------------
// Query: Garden Signal Pools (strategies for a community)
// ---------------------------------------------------------------------------

const GARDEN_POOLS_QUERY = gql`
  ${STRATEGY_FIELDS}
  query GardenPools($communityAddress: String!) {
    cvstrategies(
      where: { registryCommunity_: { id: $communityAddress } }
      orderBy: poolId
      orderDirection: asc
    ) {
      ...StrategyFields
    }
  }
`;

interface CVStrategiesResponse {
  cvstrategies: StrategyNode[];
}

/**
 * Fetches signal pools (CV strategies) for a garden from the subgraph.
 * Pool ordering matches the contract: index 0 = Action, index 1 = Hypercert.
 */
export async function getGardenPoolsFromSubgraph(
  communityAddress: Address,
  gardenAddress: Address,
  chainId: number
): Promise<GardenSignalPool[]> {
  const client = getClient(chainId);

  const { data, error } = await client.query<CVStrategiesResponse>(
    GARDEN_POOLS_QUERY,
    { communityAddress: communityAddress.toLowerCase() },
    "getGardenPools"
  );

  if (error) {
    logger.error("[gardens] Failed to fetch garden pools", {
      error: error.message,
      communityAddress,
      chainId,
    });
    return [];
  }

  const strategies = data?.cvstrategies ?? [];

  return strategies.map((strategy, index) => ({
    poolAddress: strategy.id as Address,
    poolType: index === 0 ? PoolType.Action : PoolType.Hypercert,
    gardenAddress,
    communityAddress: communityAddress as Address,
  }));
}

// ---------------------------------------------------------------------------
// Query: Conviction Weights (proposals with staked amounts in a strategy)
// ---------------------------------------------------------------------------

const CONVICTION_WEIGHTS_QUERY = gql`
  ${PROPOSAL_FIELDS}
  query ConvictionWeights($strategyId: String!) {
    cvproposals(
      where: { strategy_: { id: $strategyId }, proposalStatus_not: 6 }
      orderBy: proposalNumber
      orderDirection: asc
    ) {
      ...ProposalFields
    }
  }
`;

interface CVProposalsResponse {
  cvproposals: {
    id: string;
    proposalNumber: string;
    stakedAmount: string;
    convictionLast: string;
    blockLast: string;
    proposalStatus: number;
  }[];
}

/**
 * Fetches conviction weights for all proposals in a strategy (pool).
 * Maps subgraph CVProposal data to the ConvictionWeight interface.
 */
export async function getConvictionWeightsFromSubgraph(
  poolAddress: Address,
  chainId: number
): Promise<ConvictionWeight[]> {
  const client = getClient(chainId);

  const { data, error } = await client.query<CVProposalsResponse>(
    CONVICTION_WEIGHTS_QUERY,
    { strategyId: poolAddress.toLowerCase() },
    "getConvictionWeights"
  );

  if (error) {
    logger.error("[gardens] Failed to fetch conviction weights", {
      error: error.message,
      poolAddress,
      chainId,
    });
    return [];
  }

  return (data?.cvproposals ?? []).map((proposal) => ({
    hypercertId: BigInt(proposal.proposalNumber),
    weight: BigInt(proposal.convictionLast),
  }));
}

// ---------------------------------------------------------------------------
// Query: Registered Hypercerts (active proposals in a strategy)
// ---------------------------------------------------------------------------

const REGISTERED_HYPERCERTS_QUERY = gql`
  query RegisteredHypercerts($strategyId: String!) {
    cvproposals(
      where: { strategy_: { id: $strategyId }, proposalStatus_not: 6 }
      orderBy: proposalNumber
      orderDirection: asc
    ) {
      proposalNumber
    }
  }
`;

interface RegisteredHypercertsResponse {
  cvproposals: { proposalNumber: string }[];
}

/**
 * Returns the list of registered hypercert IDs for a strategy pool.
 */
export async function getRegisteredHypercertsFromSubgraph(
  poolAddress: Address,
  chainId: number
): Promise<bigint[]> {
  const client = getClient(chainId);

  const { data, error } = await client.query<RegisteredHypercertsResponse>(
    REGISTERED_HYPERCERTS_QUERY,
    { strategyId: poolAddress.toLowerCase() },
    "getRegisteredHypercerts"
  );

  if (error) {
    logger.error("[gardens] Failed to fetch registered hypercerts", {
      error: error.message,
      poolAddress,
      chainId,
    });
    return [];
  }

  return (data?.cvproposals ?? []).map((p) => BigInt(p.proposalNumber));
}

// ---------------------------------------------------------------------------
// Query: Member Voting Power
// ---------------------------------------------------------------------------

const MEMBER_POWER_QUERY = gql`
  query MemberPower($strategyId: String!, $memberId: String!) {
    memberStrategies(
      where: { strategy_: { id: $strategyId }, member_: { id: $memberId } }
    ) {
      totalStakedPoints
      activatedPoints
      member {
        id
        stakes(where: { proposal_: { strategy_: { id: $strategyId } } }) {
          amount
          proposal {
            proposalNumber
          }
        }
      }
    }
    cvstrategy(id: $strategyId) {
      config {
        minThresholdPoints
        pointSystem
      }
    }
  }
`;

interface MemberPowerResponse {
  memberStrategies: {
    totalStakedPoints: string;
    activatedPoints: string;
    member: {
      id: string;
      stakes: {
        amount: string;
        proposal: { proposalNumber: string };
      }[];
    };
  }[];
  cvstrategy: {
    config: {
      minThresholdPoints: string;
      pointSystem: number;
    };
  } | null;
}

/**
 * Fetches a member's voting power and allocations for a given strategy pool.
 * Combines MemberStrategy + Stake data from the subgraph.
 */
export async function getMemberPowerFromSubgraph(
  poolAddress: Address,
  voterAddress: Address,
  chainId: number
): Promise<MemberPower> {
  const empty: MemberPower = {
    totalStake: 0n,
    pointsBudget: 0n,
    isEligible: false,
    allocations: [],
  };

  const client = getClient(chainId);

  const { data, error } = await client.query<MemberPowerResponse>(
    MEMBER_POWER_QUERY,
    {
      strategyId: poolAddress.toLowerCase(),
      memberId: voterAddress.toLowerCase(),
    },
    "getMemberPower"
  );

  if (error) {
    logger.error("[gardens] Failed to fetch member power", {
      error: error.message,
      poolAddress,
      voterAddress,
      chainId,
    });
    return empty;
  }

  const memberStrategy = data?.memberStrategies?.[0];
  if (!memberStrategy) return empty;

  const totalStake = BigInt(memberStrategy.totalStakedPoints);
  const activatedPoints = BigInt(memberStrategy.activatedPoints);
  const pointsBudget = activatedPoints;
  const isEligible = activatedPoints > 0n;

  const allocations: VoterAllocation[] = (memberStrategy.member.stakes ?? []).map((stake) => ({
    hypercertId: BigInt(stake.proposal.proposalNumber),
    amount: BigInt(stake.amount),
  }));

  return {
    totalStake,
    pointsBudget,
    isEligible,
    allocations,
  };
}

// ---------------------------------------------------------------------------
// Query: Conviction Strategies (all strategy addresses for a garden)
// ---------------------------------------------------------------------------

const CONVICTION_STRATEGIES_QUERY = gql`
  query ConvictionStrategies($communityAddress: String!) {
    cvstrategies(
      where: { registryCommunity_: { id: $communityAddress } }
      orderBy: poolId
      orderDirection: asc
    ) {
      id
      isEnabled
    }
  }
`;

interface ConvictionStrategiesResponse {
  cvstrategies: { id: string; isEnabled: boolean }[];
}

/**
 * Fetches all conviction strategy addresses for a community.
 * Returns only enabled strategies.
 */
export async function getConvictionStrategiesFromSubgraph(
  communityAddress: Address,
  chainId: number
): Promise<Address[]> {
  const client = getClient(chainId);

  const { data, error } = await client.query<ConvictionStrategiesResponse>(
    CONVICTION_STRATEGIES_QUERY,
    { communityAddress: communityAddress.toLowerCase() },
    "getConvictionStrategies"
  );

  if (error) {
    logger.error("[gardens] Failed to fetch conviction strategies", {
      error: error.message,
      communityAddress,
      chainId,
    });
    return [];
  }

  return (data?.cvstrategies ?? []).filter((s) => s.isEnabled).map((s) => s.id as Address);
}
