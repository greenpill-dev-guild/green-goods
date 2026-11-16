import { describe, expect, it, vi } from "vitest";
import { getEASConfig } from "../../../config/blockchain";
import { getGardenMemberContributions } from "../../../modules/data/garden-member-contributions";
import type { GraphQLReader } from "../../../modules/data/graphql-client";

const garden = "0x1111111111111111111111111111111111111111";
const otherGarden = "0x2222222222222222222222222222222222222222";
const account = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const otherAccount = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const chainId = 42161;
const uid = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;
const attestation = (at: number, review = false, overrides = {}) => ({
  id: uid(at),
  attester: account,
  recipient: garden,
  timeCreated: at,
  revoked: false,
  schemaId: getEASConfig(chainId)[review ? "WORK_APPROVAL" : "WORK"].uid,
  decodedDataJson: JSON.stringify(review ? [{ name: "workUID", value: { value: uid(1) } }] : []),
  ...overrides,
});
const evidence = (at: number, overrides = {}) => ({
  id: `event-${at}`,
  chainId,
  actor: account,
  eventType: "EVIDENCE_ATTACHED",
  timestamp: at,
  commitmentEntityId: "42161-1",
  ...overrides,
});
const commitment = (overrides = {}) => ({
  id: "42161-1",
  chainId,
  creationSeen: true,
  providerGarden: garden,
  garden: otherGarden,
  ...overrides,
});
function setup({
  works = [] as unknown[],
  reviews = [] as unknown[],
  events = [] as unknown[],
  commitments = [commitment()] as unknown[],
  excluded = [] as string[],
} = {}) {
  const easQuery = vi.fn().mockResolvedValue({ data: { works, reviews } });
  const indexerQuery = vi.fn().mockImplementation((_query, _variables, operation) =>
    Promise.resolve({
      data:
        operation === "getMemberEvidenceCommitments"
          ? { Commitment: commitments }
          : { CommitmentEvent: events },
    })
  );
  const dependencies = {
    eas: { query: easQuery } as GraphQLReader,
    indexer: { query: indexerQuery } as GraphQLReader,
    reporting: {
      links: vi.fn().mockResolvedValue({
        workUIDs: new Set(excluded),
        assessmentUIDs: new Set(),
        commitmentEntityIds: [],
        attestationUIDs: excluded,
      }),
    },
  };
  const read = () =>
    getGardenMemberContributions({ garden, accounts: [account], chainId }, dependencies);
  return { read, easQuery, indexerQuery, dependencies };
}

describe("getGardenMemberContributions", () => {
  it.each([
    [100, 90, 80, 100],
    [80, 100, 90, 100],
    [80, 90, 100, 100],
  ])("selects the latest public submission, review or attached evidence (%s,%s,%s)", async (work, review, proof, latest) => {
    const { read } = setup({
      works: [attestation(work)],
      reviews: [attestation(review, true)],
      events: [evidence(proof)],
    });
    expect((await read())[account]).toEqual({ status: "recorded", at: latest * 1000 });
  });
  it("asks for this actor's latest records within this garden without a 200-work activity window", async () => {
    const { read, easQuery } = setup();
    await read();
    expect(easQuery).toHaveBeenCalledWith(
      expect.stringContaining("take: 1"),
      expect.objectContaining({
        works: expect.objectContaining({
          attester: { equals: expect.any(String) },
          recipient: { equals: garden },
          revoked: { equals: false },
        }),
        reviews: expect.objectContaining({
          schemaId: { equals: getEASConfig(chainId).WORK_APPROVAL.uid },
        }),
      }),
      "getMemberContributions",
      undefined
    );
  });
  it("reports no contribution only when all public sources are empty", async () => {
    expect((await setup().read())[account]).toEqual({ status: "none" });
  });
  it.each([
    { recipient: otherGarden },
    { attester: otherAccount },
    { timeCreated: -1 },
    { revoked: true },
    { schemaId: uid(777) },
  ])("rejects malformed or out-of-scope EAS records: %j", async (overrides) => {
    expect((await setup({ works: [attestation(100, false, overrides)] }).read())[account]).toEqual({
      status: "unavailable",
    });
  });
  it("counts only the recorded attacher, never credited contributors or the pool garden", async () => {
    const { read } = setup({
      events: [evidence(100)],
      commitments: [commitment({ providerGarden: otherGarden, garden })],
    });
    expect((await read())[account]).toEqual({ status: "none" });
  });
  it.each([
    null,
    "0x0000000000000000000000000000000000000000",
  ])("treats an evidence commitment with an incomplete provider garden (%s) as unavailable", async (providerGarden) => {
    expect(
      (
        await setup({
          events: [evidence(100)],
          commitments: [commitment({ providerGarden, garden })],
        }).read()
      )[account]
    ).toEqual({ status: "unavailable" });
  });
  it.each([
    { actor: otherAccount },
    { eventType: "FULFILLED" },
    { chainId: 11155111 },
    { timestamp: 0 },
    { commitmentEntityId: null },
  ])("refuses invalid or wrong-actor evidence rather than inventing a date: %j", async (overrides) => {
    expect((await setup({ events: [evidence(100, overrides)] }).read())[account]).toEqual({
      status: "unavailable",
    });
  });
  it("excludes rehearsal work and its reviews without filtering feedback text", async () => {
    const { read, easQuery } = setup({
      reviews: [
        attestation(100, true, {
          decodedDataJson: JSON.stringify([
            { name: "workUID", value: { value: uid(2) } },
            { name: "feedback", value: { value: uid(1) } },
          ]),
        }),
      ],
      excluded: [uid(1)],
    });
    expect((await read())[account]).toEqual({ status: "recorded", at: 100000 });
    expect(easQuery.mock.calls[0][1].works.id.notIn).toEqual([uid(1)]);
    expect(easQuery.mock.calls[0][1].reviews).not.toHaveProperty("decodedDataJson");
  });
  it("pages past hidden reviews to find an older public review", async () => {
    const { read, easQuery } = setup({ excluded: [uid(1)] });
    easQuery
      .mockResolvedValueOnce({
        data: {
          works: [],
          reviews: Array.from({ length: 50 }, (_, i) => attestation(1000 - i, true)),
        },
      })
      .mockResolvedValueOnce({
        data: {
          works: [],
          reviews: [
            attestation(900, true, {
              decodedDataJson: JSON.stringify([{ name: "workUID", value: { value: uid(2) } }]),
            }),
          ],
        },
      });
    expect((await read())[account]).toEqual({ status: "recorded", at: 900000 });
    expect(easQuery.mock.calls[1][1]).toMatchObject({ skip: 50 });
  });
  it("returns unavailable on a truncated scan or missing evidence relationship", async () => {
    const { read, indexerQuery } = setup({
      events: Array.from({ length: 50 }, (_, i) => evidence(1000 - i)),
      commitments: [commitment({ providerGarden: otherGarden })],
    });
    expect((await read())[account]).toEqual({ status: "unavailable" });
    expect(indexerQuery.mock.calls.length).toBeLessThanOrEqual(20);
    expect((await setup({ events: [evidence(100)], commitments: [] }).read())[account]).toEqual({
      status: "unavailable",
    });
  });
  it("distinguishes unavailable sources from empty results and isolates a member's failure", async () => {
    const { read, easQuery } = setup();
    easQuery.mockResolvedValue({ error: new Error("offline") });
    expect((await read())[account]).toEqual({ status: "unavailable" });
  });
  it("isolates a member's failed source while another member has a complete empty read", async () => {
    const { dependencies, easQuery } = setup();
    easQuery.mockImplementation((_query, variables) =>
      Promise.resolve(
        variables.works.attester.equals.toLowerCase() === account
          ? { error: new Error("unavailable") }
          : { data: { works: [], reviews: [] } }
      )
    );
    expect(
      await getGardenMemberContributions(
        { garden, accounts: [account, otherAccount], chainId },
        dependencies
      )
    ).toEqual({ [account]: { status: "unavailable" }, [otherAccount]: { status: "none" } });
  });
  it("uses the authoritative rehearsal exclusions in the evidence read and fails closed when they are unavailable", async () => {
    const { dependencies, indexerQuery, read } = setup();
    dependencies.reporting.links.mockResolvedValue({
      workUIDs: new Set(),
      assessmentUIDs: new Set(),
      commitmentEntityIds: ["42161-9"],
      attestationUIDs: [],
    });
    await read();
    expect(indexerQuery.mock.calls[0][1].where.commitmentEntityId).toEqual({ _nin: ["42161-9"] });
    expect(dependencies.reporting.links).toHaveBeenCalledTimes(1);
    dependencies.reporting.links.mockRejectedValue(new Error("exclusions unavailable"));
    await expect(read()).rejects.toThrow("exclusions unavailable");
  });
  it("keeps an exhausted hidden-review scan unavailable instead of claiming no records", async () => {
    const { read, easQuery } = setup({
      reviews: Array.from({ length: 50 }, (_, i) => attestation(1000 - i, true)),
      excluded: [uid(1)],
    });
    expect((await read())[account]).toEqual({ status: "unavailable" });
    expect(easQuery).toHaveBeenCalledTimes(10);
  });
  it("does not turn cancellation into a cached unavailable fact", async () => {
    const { dependencies } = setup();
    const controller = new AbortController();
    controller.abort(new Error("scope changed"));
    await expect(
      getGardenMemberContributions(
        { garden, accounts: [account], chainId },
        dependencies,
        controller.signal
      )
    ).rejects.toThrow("scope changed");
  });
});
