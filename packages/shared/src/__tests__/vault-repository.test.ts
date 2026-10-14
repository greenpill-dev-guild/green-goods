import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import type { RequestDocument } from "graphql-request";
import { describe, expect, it } from "vitest";
import type { GraphQLReader } from "../modules/data/graphql-client";
import { createVaultRepository } from "../modules/data/vault-repository";

type FakeResult = Record<string, unknown> | Error;

class FakeReader implements GraphQLReader {
  readonly operations: Array<{ name?: string; variables?: Record<string, unknown> }> = [];

  constructor(private readonly read: (operationName?: string) => FakeResult) {}

  async query<TData, TVariables extends Record<string, unknown> = Record<string, unknown>>(
    _document: TypedDocumentNode<TData, TVariables> | RequestDocument,
    variables?: TVariables,
    operationName?: string
  ): Promise<{ data: TData; error?: undefined } | { data?: undefined; error: Error }> {
    this.operations.push({ name: operationName, variables });
    const result = this.read(operationName);
    return result instanceof Error
      ? { error: result }
      : { data: result as TData, error: undefined };
  }
}

const GARDEN = "0x2222222222222222222222222222222222222222";
const ASSET = "0x3333333333333333333333333333333333333333";
const VAULT = "0x4444444444444444444444444444444444444444";

describe("VaultRepository", () => {
  it("returns an empty result when a successful query has no rows", async () => {
    const repository = createVaultRepository(new FakeReader(() => ({ GardenVault: [] })));

    await expect(repository.getGardenVaults(GARDEN, 42161)).resolves.toEqual({
      status: "empty",
      data: [],
    });
  });

  it("normalizes a successful vault row through the injected reader", async () => {
    const reader = new FakeReader(() => ({
      GardenVault: [
        {
          id: "42161-vault",
          chainId: 42161,
          garden: GARDEN.toUpperCase(),
          asset: ASSET.toUpperCase(),
          vaultAddress: VAULT.toUpperCase(),
          totalDeposited: "120",
          totalWithdrawn: "20",
          totalHarvestCount: 2,
          donationAddress: null,
          depositorCount: 3,
          paused: false,
          createdAt: 10,
        },
      ],
    }));
    const repository = createVaultRepository(reader);

    await expect(repository.getGardenVaults(GARDEN, 42161)).resolves.toEqual({
      status: "ok",
      data: [
        expect.objectContaining({
          garden: GARDEN,
          asset: ASSET,
          vaultAddress: VAULT,
          totalDeposited: 120n,
          totalWithdrawn: 20n,
        }),
      ],
    });
    expect(reader.operations).toEqual([
      {
        name: "getGardenVaults",
        variables: { chainId: 42161, garden: GARDEN },
      },
    ]);
  });

  it("returns a typed error result instead of throwing an indexer failure", async () => {
    const failure = new Error("indexer unavailable");
    const repository = createVaultRepository(new FakeReader(() => failure));

    await expect(repository.getAllYieldAllocations(42161)).resolves.toEqual({
      status: "error",
      error: failure,
    });
  });

  it("reports a partial garden snapshot when one independent read fails", async () => {
    const failure = new Error("deposits unavailable");
    const reader = new FakeReader((operation) =>
      operation === "getGardenVaults"
        ? {
            GardenVault: [
              {
                id: "42161-vault",
                chainId: 42161,
                garden: GARDEN,
                asset: ASSET,
                vaultAddress: VAULT,
                totalDeposited: "120",
                totalWithdrawn: "20",
                totalHarvestCount: 2,
                donationAddress: null,
                depositorCount: 3,
                paused: false,
                createdAt: 10,
              },
            ],
          }
        : failure
    );
    const repository = createVaultRepository(reader);

    await expect(repository.getGardenVaultSnapshot(GARDEN, 42161)).resolves.toEqual({
      status: "partial",
      data: {
        vaults: [expect.objectContaining({ id: "42161-vault" })],
        deposits: [],
      },
      error: failure,
    });
  });
});
