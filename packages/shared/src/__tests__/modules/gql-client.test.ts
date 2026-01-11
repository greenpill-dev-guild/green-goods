/**
 * GQLClient Unit Tests
 *
 * Tests for the GraphQL client wrapper class.
 */
import { describe, it, expect } from "vitest";
import {
  GQLClient,
  createEasClient,
  createIndexerClient,
  greenGoodsIndexer,
  TimeoutError,
  GRAPHQL_TIMEOUT_MS,
} from "../../modules/data/graphql-client";

describe("GQLClient", () => {
  describe("constructor", () => {
    it("creates client with provided URL", () => {
      const client = new GQLClient("https://test.example.com/graphql");

      expect(client).toBeDefined();
      expect(typeof client.query).toBe("function");
      expect(typeof client.request).toBe("function");
    });
  });

  describe("query method", () => {
    it("returns error object when query fails with network error", async () => {
      // Create a client pointing to a non-existent server
      const client = new GQLClient("https://invalid.nonexistent.localhost/graphql");
      const mockDocument = { kind: "Document", definitions: [] } as any;

      const result = await client.query(mockDocument);

      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error).toBeInstanceOf(Error);
    });

    it("handles variables parameter", async () => {
      const client = new GQLClient("https://invalid.nonexistent.localhost/graphql");
      const mockDocument = { kind: "Document", definitions: [] } as any;

      // Should not throw on call, even if the network fails
      const result = await client.query(mockDocument, { id: "123" }, "TestOperation");

      expect(result.error).toBeDefined();
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
      const client = createEasClient(84532);

      expect(client).toBeInstanceOf(GQLClient);
      expect(typeof client.query).toBe("function");
      expect(typeof client.request).toBe("function");
    });

    it("works without chain ID", () => {
      const client = createEasClient();

      expect(client).toBeInstanceOf(GQLClient);
    });

    it("accepts string chain ID", () => {
      const client = createEasClient("84532");

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

describe("TimeoutError", () => {
  it("is an Error with timeout property", () => {
    const error = new TimeoutError("Test timed out", 5000);

    expect(error.name).toBe("TimeoutError");
    expect(error.message).toBe("Test timed out");
    expect(error.timeoutMs).toBe(5000);
    expect(error).toBeInstanceOf(Error);
  });
});

describe("GRAPHQL_TIMEOUT_MS", () => {
  it("is set to 12 seconds", () => {
    expect(GRAPHQL_TIMEOUT_MS).toBe(12_000);
  });
});
