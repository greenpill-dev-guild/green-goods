import assert from "node:assert/strict";

import { DEFAULT_IPFS_GATEWAY } from "../src/handlers/constants";
import {
  fetchJson,
  getString,
  getStringArray,
  isRecord,
  parseHypercertMetadata,
  resolveIpfsUri,
} from "../src/handlers/metadata";

describe("resolveIpfsUri", () => {
  it("converts ipfs:// URIs to gateway URL", () => {
    assert.equal(resolveIpfsUri("ipfs://bafkreiabc123"), `${DEFAULT_IPFS_GATEWAY}bafkreiabc123`);
  });
  it("passes through non-IPFS URIs unchanged", () => {
    const url = "https://example.com/metadata.json";
    assert.equal(resolveIpfsUri(url), url);
  });
  it("passes through empty string unchanged", () => assert.equal(resolveIpfsUri(""), ""));
});

describe("isRecord", () => {
  it("returns true for plain objects", () => {
    assert.equal(isRecord({}), true);
    assert.equal(isRecord({ key: "value" }), true);
  });
  it("returns false for arrays", () => assert.equal(isRecord([]), false));
  it("returns false for null", () => assert.equal(isRecord(null), false));
  it("returns false for primitives", () => {
    assert.equal(isRecord("string"), false);
    assert.equal(isRecord(42), false);
    assert.equal(isRecord(undefined), false);
  });
});

describe("getString", () => {
  it("returns string values", () => assert.equal(getString("hello"), "hello"));
  it("returns undefined for non-strings", () => {
    assert.equal(getString(42), undefined);
    assert.equal(getString(null), undefined);
    assert.equal(getString(undefined), undefined);
    assert.equal(getString({}), undefined);
  });
});

describe("getStringArray", () => {
  it("returns array of strings", () => assert.deepEqual(getStringArray(["a", "b"]), ["a", "b"]));
  it("filters out non-string entries", () =>
    assert.deepEqual(getStringArray(["a", 42, "b"]), ["a", "b"]));
  it("returns undefined for non-arrays", () => {
    assert.equal(getStringArray("not array"), undefined);
    assert.equal(getStringArray(42), undefined);
    assert.equal(getStringArray(null), undefined);
  });
  it("returns undefined for empty string array after filtering", () => {
    assert.equal(getStringArray([42, true, null]), undefined);
  });
});

describe("fetchJson", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("resolves IPFS metadata and returns parsed JSON", async () => {
    let requested = "";
    globalThis.fetch = async (input) => {
      requested = String(input);
      return new Response(JSON.stringify({ name: "Garden" }), { status: 200 });
    };
    assert.deepEqual(await fetchJson("ipfs://bafk-meta", undefined, 1_000, 1, 0), {
      name: "Garden",
    });
    assert.equal(requested, `${DEFAULT_IPFS_GATEWAY}bafk-meta`);
  });

  it("retries a retryable response and stops on success", async () => {
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts += 1;
      return attempts === 1
        ? new Response("unavailable", { status: 503 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    assert.deepEqual(await fetchJson("https://example.com/meta", undefined, 1_000, 2, 0), {
      ok: true,
    });
    assert.equal(attempts, 2);
  });
});

describe("parseHypercertMetadata", () => {
  it("returns empty object for non-record input", () => {
    assert.deepEqual(parseHypercertMetadata(null), {});
    assert.deepEqual(parseHypercertMetadata("string"), {});
    assert.deepEqual(parseHypercertMetadata(42), {});
  });

  it("extracts top-level title, description, imageUri", () => {
    const result = parseHypercertMetadata({
      name: "Test Cert",
      description: "A test hypercert",
      image: "ipfs://bafk-image",
    });
    assert.equal(result.title, "Test Cert");
    assert.equal(result.description, "A test hypercert");
    assert.equal(result.imageUri, `${DEFAULT_IPFS_GATEWAY}bafk-image`);
  });

  it("extracts work scopes from hypercert.work_scope.value", () => {
    const result = parseHypercertMetadata({
      hypercert: { work_scope: { value: ["scope-a", "scope-b"] } },
    });
    assert.deepEqual(result.workScopes, ["scope-a", "scope-b"]);
  });

  it("extracts gardenId and attestationUIDs from hidden_properties", () => {
    const result = parseHypercertMetadata({
      hidden_properties: {
        gardenId: "0xgarden",
        attestationRefs: [{ uid: "0xatt-1" }, { uid: "0xatt-2" }],
      },
    });
    assert.equal(result.gardenId, "0xgarden");
    assert.deepEqual(result.attestationUIDs, ["0xatt-1", "0xatt-2"]);
  });

  it("handles missing optional fields gracefully", () => {
    const result = parseHypercertMetadata({});
    assert.equal(result.title, undefined);
    assert.equal(result.description, undefined);
    assert.equal(result.imageUri, undefined);
    assert.equal(result.workScopes, undefined);
    assert.equal(result.gardenId, undefined);
    assert.equal(result.attestationUIDs, undefined);
  });

  it("skips non-object attestationRefs entries", () => {
    const result = parseHypercertMetadata({
      hidden_properties: { attestationRefs: ["not-an-object", { uid: "0xatt-1" }, null] },
    });
    assert.deepEqual(result.attestationUIDs, ["0xatt-1"]);
  });

  it("returns undefined attestationUIDs when refs have no uids", () => {
    const result = parseHypercertMetadata({
      hidden_properties: { attestationRefs: [{ notUid: "value" }] },
    });
    assert.equal(result.attestationUIDs, undefined);
  });
});
