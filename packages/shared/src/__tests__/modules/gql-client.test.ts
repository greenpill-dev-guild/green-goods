/**
 * GQLClient Unit Tests
 *
 * Tests for the GraphQL client wrapper class.
 */
import { getEventListeners } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
  createEasClient,
  createIndexerClient,
  GQLClient,
  GRAPHQL_TIMEOUT_MS,
  greenGoodsIndexer,
} from "../../modules/data/graphql-client";
import { withoutAbortSignalAny } from "../test-utils/abort-signal-any";

const GARDENS_QUERY = "query Gardens { gardens { id } }";

describe("GQLClient", () => {
  describe("query method", () => {
    // Public garden reads pass their own signal. On Chrome 111–115 and iOS 16.4–17.3 that read
    // threw "AbortSignal.any is not a function" before it reached the network.
    it("reads with a caller's signal where AbortSignal.any is missing, leaving no listener on it", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ data: { gardens: [] } }), {
          headers: { "Content-Type": "application/json" },
        })
      );
      const caller = new AbortController();
      const client = new GQLClient("https://indexer.test/graphql");

      const result = await withoutAbortSignalAny(() =>
        client.query(GARDENS_QUERY, {}, "Gardens", caller.signal)
      );

      expect(result).toEqual({ data: { gardens: [] } });
      // A paged read hands one signal to every page, so no page may leave a listener on it.
      expect(getEventListeners(caller.signal, "abort")).toHaveLength(0);
    });

    it.each([
      [
        "the caller aborts",
        (caller: AbortController) => caller.abort(new Error("garden deadline")),
      ],
      ["the read times out", () => vi.advanceTimersByTimeAsync(GRAPHQL_TIMEOUT_MS)],
    ])("stops the request when %s where AbortSignal.any is missing", async (_when, stop) => {
      vi.useFakeTimers();
      try {
        vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => {}));
        const caller = new AbortController();
        const client = new GQLClient("https://indexer.test/graphql");

        const result = await withoutAbortSignalAny(async () => {
          const read = client.query(GARDENS_QUERY, {}, "Gardens", caller.signal);
          await vi.advanceTimersByTimeAsync(0);
          await stop(caller);
          return read;
        });

        expect(fetch).toHaveBeenCalledOnce();
        const [, init] = vi.mocked(fetch).mock.calls[0];
        expect(result.error).toBeInstanceOf(Error);
        expect(init?.signal?.reason).toBe(result.error);
      } finally {
        vi.useRealTimers();
      }
    });

    it("returns error object when query fails with network error", async () => {
      // Create a client pointing to a non-existent server
      const client = new GQLClient("https://invalid.nonexistent.localhost/graphql");
      const mockDocument = { kind: "Document", definitions: [] } as any;

      const result = await client.query(mockDocument);

      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe("request method", () => {
    it("throws when query fails", async () => {
      const client = new GQLClient("https://invalid.nonexistent.localhost/graphql");
      const mockDocument = { kind: "Document", definitions: [] } as any;

      await expect(client.request(mockDocument)).rejects.toThrow();
    });
  });
});

describe("Factory functions", () => {
  describe("createEasClient", () => {
    it("creates a GQLClient instance", () => {
      const client = createEasClient(11155111);

      expect(client).toBeInstanceOf(GQLClient);
      expect(typeof client.query).toBe("function");
      expect(typeof client.request).toBe("function");
    });

    it("works without chain ID", () => {
      const client = createEasClient();

      expect(client).toBeInstanceOf(GQLClient);
    });

    it("accepts string chain ID", () => {
      const client = createEasClient("11155111");

      expect(client).toBeInstanceOf(GQLClient);
    });
  });

  describe("createIndexerClient", () => {
    it("creates a GQLClient instance", () => {
      const client = createIndexerClient("https://custom-indexer.example.com/graphql");

      expect(client).toBeInstanceOf(GQLClient);
    });
  });

  describe("greenGoodsIndexer singleton", () => {
    it("is a valid GQLClient instance", () => {
      expect(greenGoodsIndexer).toBeDefined();
      expect(greenGoodsIndexer).toBeInstanceOf(GQLClient);
      expect(typeof greenGoodsIndexer.query).toBe("function");
    });
  });
});
