import { describe, expect, it } from "vitest";
import { resolveDeferredWorkIdentity } from "../modules/commitment-pooling/work-identity";
import type { EASWork } from "../types/eas-responses";

const CALLER = "0x1111111111111111111111111111111111111111";
const GARDEN = "0x2222222222222222222222222222222222222222";
const OTHER_GARDEN = "0x3333333333333333333333333333333333333333";
const UID = `0x${"44".repeat(32)}`;

function work(id = UID, gardenAddress = GARDEN, metadata = "bafy-meta"): EASWork {
  return {
    id,
    gardenerAddress: CALLER,
    gardenAddress,
    actionUID: 1,
    title: "Work",
    feedback: "",
    metadata,
    media: [],
    createdAt: 1,
  };
}

function resolve(works: EASWork[], clientWorkId = "client-1") {
  return resolveDeferredWorkIdentity({
    clientWorkId,
    chainId: 42161,
    garden: GARDEN,
    caller: CALLER,
    dependencies: {
      getWorkCompletion: async () => undefined,
      getWorksByGardener: async () => works,
      readMetadata: async (raw) => ({ clientWorkId: raw }),
    },
  });
}

describe("deferred Work identity resolution", () => {
  it("resolves one exact client, caller, garden, chain candidate", async () => {
    await expect(resolve([work(UID, GARDEN, "client-1")])).resolves.toEqual({
      status: "resolved",
      workUID: UID,
    });
  });

  it("waits while the exact client id is not indexed", async () => {
    await expect(resolve([work(UID, GARDEN, "different")])).resolves.toEqual({ status: "waiting" });
  });

  it("distinguishes metadata read failure from a true zero-candidate index wait", async () => {
    await expect(
      resolveDeferredWorkIdentity({
        clientWorkId: "client-1",
        chainId: 42161,
        garden: GARDEN,
        caller: CALLER,
        dependencies: {
          getWorkCompletion: async () => undefined,
          getWorksByGardener: async () => [work()],
          readMetadata: async () => {
            throw new Error("gateway unavailable");
          },
        },
      })
    ).resolves.toEqual({ status: "retryable", reason: "work-metadata-unavailable" });
  });

  it("recovers on a later retry after a transient metadata failure", async () => {
    let attempt = 0;
    const input = {
      clientWorkId: "client-1",
      chainId: 42161,
      garden: GARDEN,
      caller: CALLER,
      dependencies: {
        getWorkCompletion: async () => undefined,
        getWorksByGardener: async () => [work()],
        readMetadata: async () => {
          if (attempt++ === 0) throw new Error("temporary gateway failure");
          return { clientWorkId: "client-1" };
        },
      },
    };
    await expect(resolveDeferredWorkIdentity(input)).resolves.toEqual({
      status: "retryable",
      reason: "work-metadata-unavailable",
    });
    await expect(resolveDeferredWorkIdentity(input)).resolves.toEqual({
      status: "resolved",
      workUID: UID,
    });
  });

  it("fails duplicate and mismatched-garden identities explicitly", async () => {
    await expect(
      resolve([work(UID, GARDEN, "client-1"), work(`0x${"55".repeat(32)}`, GARDEN, "client-1")])
    ).resolves.toEqual({ status: "conflict", reason: "work-identity-conflict" });
    await expect(resolve([work(UID, OTHER_GARDEN, "client-1")])).resolves.toEqual({
      status: "conflict",
      reason: "work-identity-conflict",
    });
  });

  it("links receipt-verified Work before indexing, including after snapshot retirement", async () => {
    const completion = {
      scope: `42161:${CALLER}:client-1`,
      clientWorkId: "client-1",
      userAddress: CALLER,
      chainId: 42161,
      gardenAddress: GARDEN,
      workUID: UID,
      transactionHash: `0x${"55".repeat(32)}`,
      jobId: "source-work",
      createdAt: 1,
    };
    for (const snapshot of [
      { ...work(UID, GARDEN, '{"clientWorkId":"client-1"}'), status: "pending" as const },
      undefined,
    ]) {
      await expect(
        resolveDeferredWorkIdentity({
          clientWorkId: "client-1",
          chainId: 42161,
          garden: GARDEN,
          caller: CALLER,
          dependencies: {
            getWorkCompletion: async () => ({
              ...completion,
              ...(snapshot ? { work: snapshot } : {}),
            }),
            getWorksByGardener: async () => {
              throw new Error("Indexer is unavailable");
            },
          },
        })
      ).resolves.toEqual({ status: "resolved", workUID: UID });
    }
  });

  it("refuses local completion identities from another account, chain, garden or client id", async () => {
    const completion = {
      scope: `42161:${CALLER}:client-1`,
      clientWorkId: "client-1",
      userAddress: CALLER,
      chainId: 42161,
      gardenAddress: GARDEN,
      workUID: UID,
      transactionHash: `0x${"55".repeat(32)}`,
      jobId: "source-work",
      createdAt: 1,
    };
    for (const change of [
      { userAddress: OTHER_GARDEN },
      { chainId: 11155111 },
      { gardenAddress: OTHER_GARDEN },
      { clientWorkId: "other-client" },
      { workUID: "0xinvalid" },
      {
        work: {
          ...work(UID, OTHER_GARDEN, '{"clientWorkId":"client-1"}'),
          status: "pending" as const,
        },
      },
    ]) {
      await expect(
        resolveDeferredWorkIdentity({
          clientWorkId: "client-1",
          chainId: 42161,
          garden: GARDEN,
          caller: CALLER,
          dependencies: {
            getWorkCompletion: async () => ({ ...completion, ...change }),
            getWorksByGardener: async () => [],
          },
        })
      ).resolves.toEqual({ status: "conflict", reason: "work-identity-conflict" });
    }
  });

  it("uses exact indexed identity for legacy completions without durable garden scope", async () => {
    await expect(
      resolveDeferredWorkIdentity({
        clientWorkId: "client-1",
        chainId: 42161,
        garden: GARDEN,
        caller: CALLER,
        dependencies: {
          getWorkCompletion: async () => ({
            scope: `42161:${CALLER}:client-1`,
            clientWorkId: "client-1",
            userAddress: CALLER,
            chainId: 42161,
            workUID: UID,
            transactionHash: "0xtransaction",
            jobId: "legacy",
            createdAt: 1,
          }),
          getWorksByGardener: async () => [work(UID, GARDEN, "client-1")],
          readMetadata: async (raw) => ({ clientWorkId: raw }),
        },
      })
    ).resolves.toEqual({ status: "resolved", workUID: UID });
  });
});
