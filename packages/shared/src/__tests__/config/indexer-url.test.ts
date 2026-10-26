import { describe, expect, it } from "vitest";
import { getIndexerUrl } from "../../config/blockchain";

// The indexer comes from the environment only: a deleted deployment must never be the fallback.
describe("getIndexerUrl", () => {
  it("uses the configured indexer, in production and in development", () => {
    const env = { VITE_ENVIO_INDEXER_URL: "https://indexer.example/v1/graphql" };
    expect(getIndexerUrl(env, false)).toBe("https://indexer.example/v1/graphql");
    expect(getIndexerUrl(env, true)).toBe("https://indexer.example/v1/graphql");
  });

  it("falls back to the local indexer in development only", () => {
    expect(getIndexerUrl({}, true)).toMatch(/localhost:3006|\/api\/graphql$/);
  });

  it("throws in production when the setting is missing", () => {
    expect(() => getIndexerUrl({}, false)).toThrow(/VITE_ENVIO_INDEXER_URL/);
  });
});
