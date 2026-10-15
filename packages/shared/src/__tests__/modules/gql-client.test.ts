/**
 * GQLClient Unit Tests
 *
 * Tests for the GraphQL client wrapper class.
 */
import { describe, expect, it } from "vitest";
import {
  createEasClient,
  createIndexerClient,
  GQLClient,
  greenGoodsIndexer,
} from "../../modules/data/graphql-client";

describe("GQLClient", () => {
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
