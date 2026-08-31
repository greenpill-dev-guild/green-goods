import assert from "node:assert/strict";
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import test from "node:test";

import {checkSearchIndex} from "./check-search-index.mjs";

const fixtures = [];

test.afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, {recursive: true, force: true});
  }
});

function createFixture(slugs = ["/community/how-it-works", "/builders/getting-started"]) {
  const root = mkdtempSync(path.join(tmpdir(), "green-goods-search-index-"));
  fixtures.push(root);

  const docsDir = path.join(root, "docs");
  const buildDir = path.join(root, "build");
  mkdirSync(docsDir, {recursive: true});
  mkdirSync(buildDir, {recursive: true});

  for (const [index, slug] of slugs.entries()) {
    writeFileSync(
      path.join(docsDir, `page-${index}.mdx`),
      `---\ntitle: Page ${index}\nslug: ${slug}\n---\n\n# Page ${index}\n`,
    );
  }

  return {root, docsDir, buildDir};
}

function searchPayload(routes) {
  return [
    {
      documents: routes.map((route, index) => ({
        i: index + 1,
        t: `Page ${index}`,
        u: route,
      })),
      index: {
        version: "2.3.9",
        fields: ["t"],
        fieldVectors: [],
        invertedIndex: [],
        pipeline: [],
      },
    },
  ];
}

function writeIndex(buildDir, payload) {
  writeFileSync(path.join(buildDir, "search-index.json"), JSON.stringify(payload));
}

test("rejects a missing search index", async () => {
  const {docsDir, buildDir} = createFixture();

  await assert.rejects(checkSearchIndex({docsDir, buildDir}), /search-index\.json is missing/);
});

test("rejects malformed search index JSON", async () => {
  const {docsDir, buildDir} = createFixture();
  writeFileSync(path.join(buildDir, "search-index.json"), "not json");

  await assert.rejects(checkSearchIndex({docsDir, buildDir}), /is not valid JSON/);
});

test("rejects a structurally invalid search index", async () => {
  const {docsDir, buildDir} = createFixture();
  writeIndex(buildDir, [{documents: "not-an-array", index: {}}]);

  await assert.rejects(checkSearchIndex({docsDir, buildDir}), /invalid documents array/);
});

test("rejects an empty search index", async () => {
  const {docsDir, buildDir} = createFixture();
  writeIndex(buildDir, searchPayload([]));

  await assert.rejects(checkSearchIndex({docsDir, buildDir}), /contains no documents/);
});

test("rejects an index missing a live source route", async () => {
  const {docsDir, buildDir} = createFixture();
  writeIndex(buildDir, searchPayload(["/community/how-it-works"]));

  await assert.rejects(
    checkSearchIndex({docsDir, buildDir}),
    /missing 1 live source route: \/builders\/getting-started/,
  );
});

test("normalizes trailing slashes before comparing routes", async () => {
  const {docsDir, buildDir} = createFixture(["/community/funder-guide/"]);
  writeIndex(buildDir, searchPayload(["/community/funder-guide"]));

  const result = await checkSearchIndex({docsDir, buildDir});

  assert.equal(result.sourceRouteCount, 1);
  assert.equal(result.indexedRouteCount, 1);
});

test("accepts an index containing every live source route", async () => {
  const routes = [
    "/community/how-it-works",
    "/builders/getting-started",
    "/reference/ontology",
  ];
  const {docsDir, buildDir} = createFixture(routes);
  writeIndex(buildDir, searchPayload(routes));

  const result = await checkSearchIndex({docsDir, buildDir});

  assert.deepEqual(result, {
    sourceRouteCount: 3,
    indexedRouteCount: 3,
    indexPath: path.join(buildDir, "search-index.json"),
  });
});
