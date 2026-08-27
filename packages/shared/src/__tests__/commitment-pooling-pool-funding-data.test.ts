import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";
import type { RawRow } from "../modules/commitment-pooling/data-core";
import { getPoolFundingSnapshot } from "../modules/commitment-pooling/data-pool-funding";
import type { GraphQLReader } from "../modules/data/graphql-client";

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
  overrides: {
    headerError?: boolean;
    pageError?: boolean;
    metadataError?: boolean;
    paginated?: boolean;
    metadataRows?: RawRow[];
    commitments?: RawRow[];
    payoutPlans?: RawRow[];
    fundings?: RawRow[];
    disbursements?: RawRow[];
    payoutRows?: RawRow[];
    executions?: RawRow[];
  } = {}
): GraphQLReader {
  return {
    query: vi.fn(
      async (_document: unknown, variables?: Record<string, unknown>, operation?: string) => {
        if (operation === "getPoolFundingHeader") {
          if (overrides.headerError) return { error: new Error("header unavailable") };
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
            },
          };
        }
        if (operation === "getPoolFundingExecutorConfiguration") {
          return { data: { SettlementConfiguration: [configuration(42220, "EXECUTOR")] } };
        }
        if (operation === "getPoolFundingFreshness") {
          if (overrides.metadataError) return { error: new Error("freshness unavailable") };
          return {
            data: {
              chain_metadata:
                overrides.metadataRows ??
                [42161, 42220].map((chainId) => ({
                  chain_id: chainId,
                  timestamp_caught_up_to_head_or_endblock: new Date(now * 1_000).toISOString(),
                })),
            },
          };
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
              Commitment:
                overrides.commitments ??
                (overrides.paginated
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
                    ]),
              CommitmentPayoutPlan: overrides.payoutPlans ?? [],
              CommitmentFunding: overrides.fundings ?? [],
              Disbursement: overrides.disbursements ?? [
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
            },
          };
        }
        if (operation === "getPoolFundingPayoutRows") {
          return { data: { ContributorPayout: overrides.payoutRows ?? [] } };
        }
        if (operation === "getPoolFundingExecutions") {
          return { data: { SettlementExecution: overrides.executions ?? [] } };
        }
        throw new Error(`Unexpected operation ${operation}`);
      }
    ) as GraphQLReader["query"],
  };
}

function clientFactory(
  options: {
    failBalance?: boolean;
    failFunctions?: Set<string>;
    blockTimestamp?: bigint;
    periodDuration?: bigint;
    maxPeriodAmount?: bigint;
    periodSpend?: readonly [bigint, bigint];
    allowance?: readonly [bigint, bigint, bigint, bigint, bigint];
    feeProbe?: { active: number; max: number };
  } = {}
) {
  const chainIds: number[] = [];
  const createClient = (chainId: number) => {
    chainIds.push(chainId);
    return {
      getBlockNumber: vi.fn().mockResolvedValue(50n),
      getBlock: vi.fn().mockResolvedValue({ timestamp: options.blockTimestamp ?? 2_100n }),
      readContract: vi.fn(
        async ({ address, functionName }: { address: string; functionName: string }) => {
          if (options.failFunctions?.has(functionName)) throw new Error(`${functionName} failed`);
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
          if (functionName === "periodDuration") return options.periodDuration ?? 2_592_000n;
          if (functionName === "maxPeriodAmount") return options.maxPeriodAmount ?? 15_000_000n;
          if (functionName === "gardenPeriodSpend") {
            return options.periodSpend ?? ([1_900n, 1_000n] as const);
          }
          if (functionName === "nativeFeeBalance") return 123n;
          if (functionName === "isAcknowledgmentFeeReserveLow") return false;
          if (functionName === "allowances") {
            return options.allowance ?? ([100n, 1_000n, 100n, 2_000n, 500n] as const);
          }
          if (functionName === "getFees") {
            if (options.feeProbe) {
              options.feeProbe.active += 1;
              options.feeProbe.max = Math.max(options.feeProbe.max, options.feeProbe.active);
              await new Promise<void>((resolve) => setTimeout(resolve, 1));
              options.feeProbe.active -= 1;
            }
            return [1n, true] as const;
          }
          throw new Error(`Unexpected ${functionName} on ${address}`);
        }
      ),
    } as unknown as PublicClient;
  };
  return { chainIds, createClient };
}

describe("pool funding hybrid reader", () => {
  it("propagates a settlement-header read failure", async () => {
    await expect(
      getPoolFundingSnapshot(42161, GARDEN, {
        reader: reader(2_050, { headerError: true }),
        createClient: clientFactory().createClient,
        now: 2_050,
      })
    ).rejects.toThrow("header unavailable");
  });

  it("reads Celo directly while the pool and obligations are keyed by Arbitrum", async () => {
    const now = 2_050;
    const clients = clientFactory();
    const indexer = reader(now);
    const snapshot = await getPoolFundingSnapshot(42161, GARDEN, {
      reader: indexer,
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
    expect(indexer.query).toHaveBeenCalledWith(
      expect.stringContaining("timestamp_caught_up_to_head_or_endblock"),
      { chainIds: [42161, 42220] },
      "getPoolFundingFreshness"
    );
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

  it("fails settlement readiness when any live execution cap cannot be read", async () => {
    for (const functionName of ["maxTransferAmount", "maxBatchAmount", "maxBatchSize"]) {
      const snapshot = await getPoolFundingSnapshot(42161, GARDEN, {
        reader: reader(2_050),
        createClient: clientFactory({ failFunctions: new Set([functionName]) }).createClient,
        now: 2_050,
      });
      expect(snapshot.settlementReadiness).toBe("unavailable");
      expect(snapshot.settlementUnavailableReasons).toContain("caps_unreadable");
    }
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

  it("requires caught-up metadata for both the source and executor chains", async () => {
    const now = 2_050;
    const snapshot = await getPoolFundingSnapshot(42161, GARDEN, {
      reader: reader(now, {
        metadataRows: [
          {
            chain_id: 42161,
            timestamp_caught_up_to_head_or_endblock: new Date(now * 1_000).toISOString(),
          },
        ],
      }),
      createClient: clientFactory().createClient,
      now,
    });
    expect(snapshot.balance?.value).toBe(1_000n);
    expect(snapshot.available).toBeNull();
    expect(snapshot.fundingUnavailableReasons).toContain("ledger_unavailable");
  });

  it("keeps finalized plans coherent when contributor snapshots include zero allocations", async () => {
    const now = 2_050;
    const snapshot = await getPoolFundingSnapshot(42161, GARDEN, {
      reader: reader(now, {
        commitments: [],
        disbursements: [],
        payoutPlans: [
          {
            id: "42161-plan-9",
            payoutPlanId: "9",
            commitmentId: "10",
            finalized: true,
            declaredAmount: "100",
            gardenRetainedAmount: "0",
            contributorPayoutTotal: "100",
            beneficiaryRecipient: null,
            beneficiaryAmount: "0",
            beneficiaryDisbursementId: null,
            payablePayoutCount: 1,
          },
        ],
        payoutRows: [
          {
            id: "payout-positive",
            payoutPlanId: "9",
            commitmentId: "10",
            recipient: RECIPIENT,
            amount: "100",
            disbursementId: null,
          },
          {
            id: "payout-zero",
            payoutPlanId: "9",
            commitmentId: "10",
            recipient: GARDEN,
            amount: "0",
            disbursementId: null,
          },
        ],
      }),
      createClient: clientFactory().createClient,
      now,
    });
    expect(snapshot.available).not.toBeNull();
    expect(snapshot.fundingUnavailableReasons).not.toContain("ledger_inconsistent");
  });

  it("uses execution keys to reconcile incoming Protocol funding", async () => {
    const now = 2_050;
    const indexer = reader(now, {
      commitments: [],
      disbursements: [
        {
          id: "42161-8",
          disbursementId: "8",
          commitmentId: null,
          payoutPlanId: null,
          fundingId: null,
          batchId: null,
          kind: "FUNDING",
          source: RECIPIENT,
          recipient: SAFE,
          amount: "50",
          state: "DISPATCHED",
          executionKey: KEY,
        },
      ],
      executions: [
        {
          id: "42220-execution-8",
          executionKey: KEY,
          status: "SUCCESS",
          createdAt: 2_000,
          acknowledgmentSent: false,
        },
      ],
    });
    const snapshot = await getPoolFundingSnapshot(42161, GARDEN, {
      reader: indexer,
      createClient: clientFactory().createClient,
      now,
    });
    expect(snapshot.transit.incoming).toBe(0n);
    expect(indexer.query).toHaveBeenCalledWith(
      expect.stringContaining("executionKey: { _in: $executionKeys }"),
      expect.objectContaining({ executorChainId: 42220, executionKeys: [KEY] }),
      "getPoolFundingExecutions"
    );
  });

  it("quotes a payout whose referenced child is absent from the indexed snapshot", async () => {
    const now = 2_050;
    const snapshot = await getPoolFundingSnapshot(42161, GARDEN, {
      reader: reader(now, {
        commitments: [],
        disbursements: [],
        payoutPlans: [
          {
            id: "42161-plan-9",
            payoutPlanId: "9",
            commitmentId: "10",
            finalized: true,
            declaredAmount: "100",
            gardenRetainedAmount: "0",
            contributorPayoutTotal: "100",
            beneficiaryRecipient: null,
            beneficiaryAmount: "0",
            beneficiaryDisbursementId: null,
            payablePayoutCount: 1,
          },
        ],
        payoutRows: [
          {
            id: "payout-1",
            payoutPlanId: "9",
            commitmentId: "10",
            recipient: RECIPIENT,
            amount: "100",
            disbursementId: "88",
          },
        ],
      }),
      createClient: clientFactory().createClient,
      now,
    });
    expect(snapshot.feeQuotes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "payout-1", fee: 1n })])
    );
    expect(snapshot.settlementUnavailableReasons).not.toContain("fee_quote_unavailable");
  });

  it("uses the sampled Celo block time for period and Roles allowance resets", async () => {
    const snapshot = await getPoolFundingSnapshot(42161, GARDEN, {
      reader: reader(2_101),
      createClient: clientFactory({
        blockTimestamp: 2_099n,
        periodDuration: 100n,
        maxPeriodAmount: 10_000n,
        periodSpend: [2_000n, 1_000n],
        allowance: [100n, 1_000n, 100n, 2_000n, 500n],
      }).createClient,
      now: 2_101,
    });

    expect(snapshot.limits.rolesAllowanceRemaining).toBe(500n);
    expect(snapshot.limits.periodAllowanceRemaining).toBe(9_000n);
  });

  it("bounds concurrent GoodDollar fee quotes for large ledgers", async () => {
    const feeProbe = { active: 0, max: 0 };
    const disbursements = Array.from({ length: 20 }, (_, index) => ({
      id: `42161-${index + 1}`,
      disbursementId: `${index + 1}`,
      commitmentId: null,
      payoutPlanId: null,
      fundingId: null,
      batchId: null,
      kind: "LOAN_PRINCIPAL",
      source: SAFE,
      recipient: RECIPIENT,
      amount: "1",
      state: "QUEUED",
      executionKey: null,
    }));
    const snapshot = await getPoolFundingSnapshot(42161, GARDEN, {
      reader: reader(2_050, { disbursements }),
      createClient: clientFactory({ feeProbe }).createClient,
      now: 2_050,
    });

    expect(snapshot.feeQuotes).toHaveLength(20);
    expect(feeProbe.max).toBeGreaterThan(1);
    expect(feeProbe.max).toBeLessThanOrEqual(8);
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
