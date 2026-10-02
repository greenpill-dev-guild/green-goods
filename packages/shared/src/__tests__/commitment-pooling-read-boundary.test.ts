import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCommitmentClaimRequests,
  getCommitmentCycles,
  getCommitmentPools,
  getCommitments,
  getCommitmentSeries,
} from "../modules/commitment-pooling/data";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("../modules/data/graphql-client", () => ({
  greenGoodsIndexer: { query: (...args: unknown[]) => mocks.query(...args) },
}));

const emptyFieldByOperation: Record<string, string> = {
  getCommitmentPools: "CommitmentPool",
  getCommitmentCycles: "CommitmentCycle",
  getCommitments: "Commitment",
  getCommitmentClaimRequests: "CommitmentClaimRequest",
  getCommitmentSeries: "CommitmentSeries",
};

/** A complete published projection, including explicit none sentinels. */
const indexedTerms = {
  poolId: "7",
  cycleId: null,
  commitmentSeriesId: null,
  creator: "0x1111111111111111111111111111111111111111",
  direction: "REQUEST",
  commitmentType: "SUPPORT_SERVICE",
  claimMode: "OPEN",
  claimType: "INDIVIDUAL",
  contributorPolicy: "LEAD_MANAGED",
  unitLabel: "survey",
  targetUnits: "1",
  dueDate: null,
  requiresAssessment: false,
  confirmers: [],
  confirmationThreshold: 1,
  protocolFallbackEnabled: false,
  considerationRail: "NONE",
  considerationSource: null,
  considerationToken: null,
  needUID: null,
  counterCommitmentId: null,
  declaredUnitValue: null,
  declaredValueBasis: null,
};

describe("commitment pooling public read boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockImplementation(
      async (_document: string, _variables: unknown, operation: string) => ({
        data: { [emptyFieldByOperation[operation]]: [] },
      })
    );
  });

  it("puts the correct seen flag in every ordinary list query", async () => {
    await getCommitmentPools(42161);
    await getCommitmentCycles({ chainId: 42161, poolId: 9n });
    await getCommitments({ chainId: 42161, poolId: 9n });
    await getCommitmentClaimRequests(42161, 11n);
    await getCommitmentSeries({ chainId: 42161, poolId: 9n });

    const documents = Object.fromEntries(
      mocks.query.mock.calls.map(([document, _variables, operation]) => [operation, document])
    );
    expect(documents.getCommitmentPools).toContain("registrationSeen: { _eq: true }");
    expect(documents.getCommitmentCycles).toContain("seedSeen: { _eq: true }");
    expect(documents.getCommitments).toContain("creationSeen: { _eq: true }");
    expect(documents.getCommitmentClaimRequests).toContain("requestSeen: { _eq: true }");
    expect(documents.getCommitmentSeries).toContain("creationSeen: { _eq: true }");
  });

  it("reads indexed action terms and leaves an incomplete projection unknown", async () => {
    const rows = [
      {
        ...indexedTerms,
        id: "42161-11",
        chainId: 42161,
        commitmentId: "11",
        creationSeen: true,
        state: "REQUESTED",
        requirementCount: 1,
      },
      {
        ...indexedTerms,
        id: "42161-12",
        chainId: 42161,
        commitmentId: "12",
        creationSeen: true,
        state: "REQUESTED",
        requirementCount: 2,
      },
      {
        ...indexedTerms,
        id: "42161-13",
        chainId: 42161,
        commitmentId: "13",
        creationSeen: true,
        state: "REQUESTED",
        requirementCount: 0,
      },
    ];
    mocks.query.mockImplementation(
      async (_document: string, _variables: unknown, operation: string) => ({
        data:
          operation === "getCommitments"
            ? { Commitment: rows }
            : {
                CommitmentRequirement: [
                  { commitmentId: "11", requirementIndex: 0, actionUID: "44", requiredCount: 3 },
                  { commitmentId: "12", requirementIndex: 0, actionUID: "45", requiredCount: 2 },
                ],
              },
      })
    );
    const commitments = await getCommitments({ chainId: 42161 });
    expect(commitments.map((row) => row.requirements)).toEqual([
      [{ actionUID: 44n, requiredCount: 3 }],
      null,
      [],
    ]);
    const request = mocks.query.mock.calls.find(
      ([, , operation]) => operation === "getCommitmentListRequirements"
    );
    expect(request?.[0]).toContain("creationSeen: { _eq: true }");
    expect(request?.[1]).toEqual({ chainId: 42161, ids: ["11", "12"] });
    mocks.query.mockImplementation(
      async (_document: string, _variables: unknown, operation: string) =>
        operation === "getCommitments"
          ? { data: { Commitment: rows } }
          : { error: new Error("unavailable") }
    );
    await expect(getCommitments({ chainId: 42161 })).resolves.toMatchObject([
      { requirements: null },
      { requirements: null },
      { requirements: [] },
    ]);
  });

  it.each([
    { invalid: "missing count", count: undefined },
    { invalid: "empty count", count: "" },
    { invalid: "boolean count", count: false },
    { invalid: "fractional count", count: 1.5 },
    { invalid: "missing index", requirement: { requirementIndex: undefined } },
    { invalid: "empty index", requirement: { requirementIndex: "" } },
    { invalid: "boolean index", requirement: { requirementIndex: false } },
    { invalid: "wrong index", requirement: { requirementIndex: 1 } },
    { invalid: "missing action", requirement: { actionUID: undefined } },
    { invalid: "empty action", requirement: { actionUID: "" } },
    { invalid: "malformed action", requirement: { actionUID: "unknown" } },
    { invalid: "negative action", requirement: { actionUID: -1 } },
    { invalid: "unsafe numeric action", requirement: { actionUID: Number.MAX_SAFE_INTEGER + 1 } },
    { invalid: "uint256 overflow", requirement: { actionUID: (2n ** 256n).toString() } },
    { invalid: "zero required count", requirement: { requiredCount: 0 } },
    { invalid: "boolean required count", requirement: { requiredCount: true } },
    { invalid: "fractional required count", requirement: { requiredCount: 1.5 } },
    { invalid: "uint32 overflow", requirement: { requiredCount: (2n ** 32n).toString() } },
    { invalid: "malformed child identity", requirement: { commitmentId: "unknown" } },
  ])("keeps a $invalid projection unknown instead of grouping guessed terms", async (test) => {
    const row = {
      ...indexedTerms,
      id: "42161-11",
      chainId: 42161,
      commitmentId: "11",
      creationSeen: true,
      state: "REQUESTED",
      requirementCount: "count" in test ? test.count : 1,
    };
    mocks.query.mockImplementation(
      async (_document: string, _variables: unknown, operation: string) => ({
        data:
          operation === "getCommitments"
            ? { Commitment: [row] }
            : {
                CommitmentRequirement: [
                  {
                    commitmentId: "11",
                    requirementIndex: 0,
                    actionUID: "44",
                    requiredCount: 3,
                    ...("requirement" in test ? test.requirement : {}),
                  },
                ],
              },
      })
    );
    await expect(getCommitments({ chainId: 42161 })).resolves.toMatchObject([
      { requirements: null },
    ]);
  });

  it("refuses duplicated requirement indexes as an incomplete projection", async () => {
    mocks.query.mockImplementation(
      async (_document: string, _variables: unknown, operation: string) => ({
        data:
          operation === "getCommitments"
            ? {
                Commitment: [
                  {
                    ...indexedTerms,
                    id: "42161-11",
                    chainId: 42161,
                    commitmentId: "11",
                    creationSeen: true,
                    state: "REQUESTED",
                    requirementCount: 2,
                  },
                ],
              }
            : {
                CommitmentRequirement: [
                  { commitmentId: "11", requirementIndex: 0, actionUID: "44", requiredCount: 3 },
                  { commitmentId: "11", requirementIndex: 0, actionUID: "45", requiredCount: 2 },
                ],
              },
      })
    );
    await expect(getCommitments({ chainId: 42161 })).resolves.toMatchObject([
      { requirements: null },
    ]);
  });

  it.each([
    { unread: "missing claim type", field: "claimType", value: undefined },
    { unread: "UNKNOWN claim type", field: "claimType", value: "UNKNOWN" },
    { unread: "missing assessment rule", field: "requiresAssessment", value: undefined },
    { unread: "missing fallback rule", field: "protocolFallbackEnabled", value: undefined },
    { unread: "missing confirmers", field: "confirmers", value: undefined },
    { unread: "missing threshold", field: "confirmationThreshold", value: undefined },
    { unread: "malformed threshold", field: "confirmationThreshold", value: false },
    { unread: "missing target", field: "targetUnits", value: undefined },
    { unread: "malformed target", field: "targetUnits", value: "unknown" },
    { unread: "missing nullable deadline", field: "dueDate", value: undefined },
    { unread: "missing rail", field: "considerationRail", value: undefined },
    { unread: "UNKNOWN rail", field: "considerationRail", value: "UNKNOWN" },
    { unread: "missing nullable source", field: "considerationSource", value: undefined },
    { unread: "missing nullable cycle", field: "cycleId", value: undefined },
  ])("keeps $unread terms individual before mapper defaults erase uncertainty", async (test) => {
    mocks.query.mockResolvedValue({
      data: {
        Commitment: [
          {
            ...indexedTerms,
            id: "42161-11",
            chainId: 42161,
            commitmentId: "11",
            creationSeen: true,
            state: "REQUESTED",
            requirementCount: 0,
            [test.field]: test.value,
          },
        ],
      },
    });
    await expect(getCommitments({ chainId: 42161 })).resolves.toMatchObject([
      { requirements: null },
    ]);
  });

  it("recognizes explicit false rules and no-deadline/no-consideration sentinels as known", async () => {
    mocks.query.mockResolvedValue({
      data: {
        Commitment: [
          {
            ...indexedTerms,
            id: "42161-11",
            chainId: 42161,
            commitmentId: "11",
            creationSeen: true,
            state: "REQUESTED",
            requirementCount: 0,
          },
        ],
      },
    });
    await expect(getCommitments({ chainId: 42161 })).resolves.toMatchObject([
      {
        requirements: [],
        dueDate: null,
        considerationRail: "NONE",
        requiresAssessment: false,
        protocolFallbackEnabled: false,
      },
    ]);
  });

  it("fails closed or filters when an indexer returns an unseen placeholder anyway", async () => {
    mocks.query.mockResolvedValueOnce({
      data: { CommitmentPool: [{ id: "42161-9", registrationSeen: false }] },
    });
    await expect(getCommitmentPools(42161)).rejects.toThrow("unseen commitment pool placeholder");

    mocks.query.mockResolvedValueOnce({
      data: { CommitmentCycle: [{ id: "42161-10", seedSeen: false }] },
    });
    await expect(getCommitmentCycles({ chainId: 42161, poolId: 9n })).rejects.toThrow(
      "unseen commitment cycle placeholder"
    );

    mocks.query.mockResolvedValueOnce({
      data: { CommitmentSeries: [{ id: "42161-12", creationSeen: false }] },
    });
    await expect(getCommitmentSeries({ chainId: 42161 })).rejects.toThrow(
      "unseen commitment series placeholder"
    );

    mocks.query.mockResolvedValueOnce({
      data: { CommitmentClaimRequest: [{ id: "claim", requestSeen: false }] },
    });
    await expect(getCommitmentClaimRequests(42161, 11n)).rejects.toThrow(
      "unseen claim request placeholder"
    );

    mocks.query.mockResolvedValueOnce({
      data: {
        Commitment: [
          {
            id: "42161-11",
            chainId: 42161,
            commitmentId: "11",
            creationSeen: false,
            state: "OFFERED",
          },
        ],
      },
    });
    await expect(getCommitments({ chainId: 42161 })).resolves.toEqual([]);
  });
});
