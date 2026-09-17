/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const WORK_SCHEMA = `0x${"66".repeat(32)}`;
vi.mock("../../config/blockchain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../config/blockchain")>()),
  getEASConfig: vi.fn(() => ({ WORK: { uid: WORK_SCHEMA } })),
}));
vi.mock("../../modules/data/graphql", () => ({ easGraphQL: vi.fn((query) => query) }));

import { getWorkSubmissionsSince } from "../../modules/data/eas-work-submissions";
import { EASFetchError } from "../../modules/data/eas-read-validation";
import type { GraphQLReader } from "../../modules/data/graphql-client";

const GARDEN = "0x2222222222222222222222222222222222222222";
const GARDENER = "0x1111111111111111111111111111111111111111";
const TX = `0x${"ab".repeat(32)}`;
const query = vi.fn();
const reader = { query } as unknown as GraphQLReader;

function attestation(id: string, txid: unknown = TX) {
  return {
    id,
    attester: GARDENER,
    recipient: GARDEN,
    timeCreated: 1_700_000_100,
    txid,
    decodedDataJson: JSON.stringify([
      { name: "actionUID", value: { value: { hex: "0x1" } } },
      { name: "feedback", value: { value: "" } },
      { name: "metadata", value: { value: '{"clientWorkId":"client-1"}' } },
    ]),
  };
}

const input = {
  attester: GARDENER,
  garden: GARDEN,
  chainId: 42161,
  sinceSeconds: 1_700_000_000.9,
} as const;

beforeEach(() => {
  query.mockReset();
});

describe("reading a gardener's recent work in one garden", () => {
  it("asks for one gardener's work in one garden since a moment, whatever the address case", async () => {
    query.mockResolvedValue({ data: { attestations: [] } });

    await getWorkSubmissionsSince(input, reader);

    expect(query).toHaveBeenCalledWith(
      expect.anything(),
      {
        where: {
          schemaId: { equals: WORK_SCHEMA },
          attester: { equals: GARDENER, mode: "insensitive" },
          recipient: { equals: GARDEN, mode: "insensitive" },
          revoked: { equals: false },
          timeCreated: { gte: 1_700_000_000 },
        },
        take: 100,
        skip: 0,
      },
      "getWorkSubmissionsSince"
    );
  });

  it("returns each work with the transaction that carried it, when the indexer has one", async () => {
    query.mockResolvedValue({
      data: {
        attestations: [
          attestation(`0x${"44".repeat(32)}`),
          attestation(`0x${"55".repeat(32)}`, "not-a-hash"),
        ],
      },
    });

    const [carried, unknown] = await getWorkSubmissionsSince(input, reader);

    expect(carried.work.metadata).toBe('{"clientWorkId":"client-1"}');
    expect(carried.transactionHash).toBe(TX);
    expect(unknown.work.id).toBe(`0x${"55".repeat(32)}`);
    expect(unknown.transactionHash).toBeUndefined();
  });

  it("reads every page", async () => {
    const full = Array.from({ length: 100 }, (_, index) =>
      attestation(`0x${index.toString(16).padStart(64, "0")}`)
    );
    query
      .mockResolvedValueOnce({ data: { attestations: full } })
      .mockResolvedValueOnce({ data: { attestations: [attestation(`0x${"ff".repeat(32)}`)] } });

    await expect(getWorkSubmissionsSince(input, reader)).resolves.toHaveLength(101);
    expect(query).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: 100 }),
      "getWorkSubmissionsSince"
    );
  });

  it("fails loudly when the indexer fails, so an error never reads as absent work", async () => {
    query.mockResolvedValue({ error: new Error("indexer unavailable") });

    await expect(getWorkSubmissionsSince(input, reader)).rejects.toBeInstanceOf(EASFetchError);
  });
});
