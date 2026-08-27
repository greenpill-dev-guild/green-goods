import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import type { GraphQLReader } from "../modules/data/graphql-client";
import { getPoolFundingSnapshot } from "../modules/commitment-pooling/data-pool-funding";

const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const SAFE = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const ROLES = "0xcccccccccccccccccccccccccccccccccccccccc" as const;
const SOURCE = "0xdddddddddddddddddddddddddddddddddddddddd" as const;
const EXECUTOR = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;
const TOKEN = "0xffffffffffffffffffffffffffffffffffffffff" as const;
const RECIPIENT = "0x1111111111111111111111111111111111111111" as const;
const KEY = `0x${"12".repeat(32)}` as const;

function configuration(chainId: number, role: "SOURCE" | "EXECUTOR") {
  return {
    id: `${chainId}`,
    chainId,
    role,
    gardenerDeliveryEnabled: true,
    protocolGarden: GARDEN,
    gDollarToken: TOKEN,
    hatsModule: null,
    commitmentPoolingModule: SOURCE,
    localContract: role === "SOURCE" ? SOURCE : EXECUTOR,
    localRouter: SOURCE,
    localChainSelector: "1",
    remoteChainSelector: "2",
    remoteEvmChainId: role === "SOURCE" ? 42220 : 42161,
    destinationGasLimit: 3_000_000,
    activePeer: role === "SOURCE" ? EXECUTOR : SOURCE,
    previousPeer: null,
    previousPeerExpiresAt: null,
    protocolVersion: 1,
    dispatcher: null,
    batchSizeLimit: 2,
    maxTransferAmount: "7000000",
    maxBatchAmount: "10000000",
    maxFeeBps: 100,
    maxFeeAmount: "50000",
    periodDuration: 2_592_000,
    maxPeriodAmount: "15000000",
    feeReserveMinimum: "1",
    nativeFeeBalance: "2",
    feeReserveLow: false,
    peerConfigured: true,
    paused: false,
    updatedAt: 2_000,
  };
}

function reader(
  now: number,
  overrides: { pageError?: boolean; metadataError?: boolean; paginated?: boolean } = {}
): GraphQLReader {
  return {
    query: vi.fn(
      async (_document: unknown, variables?: Record<string, unknown>, operation?: string) => {
        if (operation === "getPoolFundingHeader") {
          return {
            data: {
              SettlementAccount: [
                {
                  id: `42161-${GARDEN}`,
                  chainId: 42161,
                  garden: GARDEN,
                  gardenId: GARDEN,
                  accountChainId: "42220",
                  account: SAFE,
                  active: true,
                  recoveryOwners: [],
                  rolesModifier: ROLES,
                  roleKey: KEY,
                  allowanceKey: KEY,
                  permissionsConfigHash: KEY,
                  recoveryConfigHash: KEY,
                  recoveryThreshold: 1,
                  updatedAt: now,
                },
              ],
              SettlementGardenRoute: [
                {
                  id: `42220-${GARDEN}`,
                  chainId: 42220,
                  sourceChainId: 42161,
                  garden: GARDEN,
                  gardenId: GARDEN,
                  settlementAccountId: `42161-${GARDEN}`,
                  safe: SAFE,
                  rolesModifier: ROLES,
                  roleKey: KEY,
                  allowanceKey: KEY,
                  permissionsConfigHash: KEY,
                  active: true,
                  configuredAt: now,
                  updatedAt: now,
                },
              ],
              SettlementConfiguration: [configuration(42161, "SOURCE")],
              chain_metadata: [{ chain_id: 42161, block_timestamp: now }],
            },
          };
        }
        if (operation === "getPoolFundingExecutorConfiguration") {
          return { data: { SettlementConfiguration: [configuration(42220, "EXECUTOR")] } };
        }
        if (operation === "getPoolFundingFreshness") {
          if (overrides.metadataError) return { error: new Error("freshness unavailable") };
          return { data: { chain_metadata: [{ chain_id: 42161, block_timestamp: now }] } };
        }
        if (operation === "getPoolFundingLedgerPage") {
          if (overrides.pageError) return { error: new Error("indexer unavailable") };
          if (overrides.paginated && Number(variables?.offset) === 200) {
            return {
              data: {
                Commitment: [
                  {
                    id: "42161-201",
                    commitmentId: "201",
                    state: "ACCEPTED",
                    considerationRail: "CELO_SETTLEMENT",
                    considerationAmount: "100",
                    considerationPaid: false,
                  },
                ],
                CommitmentPayoutPlan: [],
                CommitmentFunding: [],
                Disbursement: [],
                SettlementExecution: [],
              },
            };
          }
          if (Number(variables?.offset) > 0) {
            return {
              data: {
                Commitment: [],
                CommitmentPayoutPlan: [],
                CommitmentFunding: [],
                Disbursement: [],
                SettlementExecution: [],
              },
            };
          }
          return {
            data: {
              Commitment: overrides.paginated
                ? Array.from({ length: 200 }, (_, index) => ({
                    id: `42161-${index + 1}`,
                    commitmentId: `${index + 1}`,
                    state: "ACCEPTED",
                    considerationRail: "CELO_SETTLEMENT",
                    considerationAmount: "100",
                    considerationPaid: false,
                  }))
                : [
                    {
                      id: "42161-1",
                      commitmentId: "1",
                      state: "ACCEPTED",
                      considerationRail: "CELO_SETTLEMENT",
                      considerationAmount: "100",
                      considerationPaid: false,
                    },
                  ],
              CommitmentPayoutPlan: [],
              CommitmentFunding: [],
              Disbursement: [
                {
                  id: "42161-5",
                  disbursementId: "5",
                  commitmentId: null,
                  payoutPlanId: null,
                  fundingId: null,
                  kind: "LOAN_PRINCIPAL",
                  source: SAFE,
                  recipient: RECIPIENT,
                  amount: "50",
                  state: "QUEUED",
                  executionKey: null,
                },
              ],
              SettlementExecution: [],
            },
          };
        }
        if (operation === "getPoolFundingPayoutRows") {
          return { data: { ContributorPayout: [] } };
        }
        throw new Error(`Unexpected operation ${operation}`);
      }
    ) as GraphQLReader["query"],
  };
}

function clientFactory(options: { failBalance?: boolean } = {}) {
  const chainIds: number[] = [];
  const createClient = (chainId: number) => {
    chainIds.push(chainId);
    return {
      getBlockNumber: vi.fn().mockResolvedValue(50n),
      getBlock: vi.fn().mockResolvedValue({ timestamp: 2_100n }),
      readContract: vi.fn(
        async ({ address, functionName }: { address: string; functionName: string }) => {
          if (functionName === "balanceOf") {
            if (options.failBalance) throw new Error("RPC failed");
            return 1_000n;
          }
          if (functionName === "paused") return false;
          if (functionName === "gardenRouteOf") return [SAFE, ROLES, KEY, KEY, KEY, true] as const;
          if (functionName === "maxFeeBps") return 100;
          if (functionName === "maxFeeAmount") return 50n;
          if (functionName === "maxTransferAmount") return 7_000_000n;
          if (functionName === "maxBatchAmount") return 10_000_000n;
          if (functionName === "maxBatchSize") return 2;
          if (functionName === "periodDuration") return 2_592_000n;
          if (functionName === "maxPeriodAmount") return 15_000_000n;
          if (functionName === "gardenPeriodSpend") return [1_900n, 1_000n] as const;
          if (functionName === "nativeFeeBalance") return 123n;
          if (functionName === "allowances") return [100n, 1_000n, 100n, 2_000n, 500n] as const;
          if (functionName === "getFees") return [1n, true] as const;
          throw new Error(`Unexpected ${functionName} on ${address}`);
        }
      ),
    } as unknown as PublicClient;
  };
  return { chainIds, createClient };
}

describe("pool funding hybrid reader", () => {
  it("reads Celo directly while the pool and obligations are keyed by Arbitrum", async () => {
    const now = 2_050;
    const clients = clientFactory();
    const snapshot = await getPoolFundingSnapshot(42161, GARDEN, {
      reader: reader(now),
      createClient: clients.createClient,
      now,
    });

    expect(clients.chainIds).toEqual([42161, 42220]);
    expect(snapshot.safe).toBe(SAFE);
    expect(snapshot.balance?.value).toBe(1_000n);
    expect(snapshot.committed).toBe(50n);
    expect(snapshot.expected).toBe(100n);
    expect(snapshot.available).toBe(849n);
    expect(snapshot.nativeFeeBalance).toBe(123n);
  });

  it("turns an RPC balance failure into unavailable data, never zero", async () => {
    const now = 2_050;
    const clients = clientFactory({ failBalance: true });
    const snapshot = await getPoolFundingSnapshot(42161, GARDEN, {
      reader: reader(now),
      createClient: clients.createClient,
      now,
    });
    expect(snapshot.balance).toBeNull();
    expect(snapshot.available).toBeNull();
    expect(snapshot.fundingUnavailableReasons).toContain("balance_unreadable");
  });

  it("fails the ledger conservatively when a paged obligation read fails", async () => {
    const now = 2_050;
    const snapshot = await getPoolFundingSnapshot(42161, GARDEN, {
      reader: reader(now, { pageError: true }),
      createClient: clientFactory().createClient,
      now,
    });
    expect(snapshot.available).toBeNull();
    expect(snapshot.balance?.value).toBe(1_000n);
    expect(snapshot.fundingUnavailableReasons).toContain("ledger_unavailable");
  });

  it("keeps the live balance visible when freshness metadata is unavailable", async () => {
    const now = 2_050;
    const snapshot = await getPoolFundingSnapshot(42161, GARDEN, {
      reader: reader(now, { metadataError: true }),
      createClient: clientFactory().createClient,
      now,
    });
    expect(snapshot.balance?.value).toBe(1_000n);
    expect(snapshot.committed).toBeNull();
    expect(snapshot.available).toBeNull();
    expect(snapshot.fundingUnavailableReasons).toContain("ledger_unavailable");
  });

  it("pages indexed obligations in deterministic 200-row batches", async () => {
    const now = 2_050;
    const snapshot = await getPoolFundingSnapshot(42161, GARDEN, {
      reader: reader(now, { paginated: true }),
      createClient: clientFactory().createClient,
      now,
    });

    expect(snapshot.expected).toBe(20_100n);
    expect(snapshot.expectedFeeBuffer).toBe(201n);
  });
});
