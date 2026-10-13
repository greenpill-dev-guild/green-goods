import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  generatedFrontmatter,
  normalizeText,
  parseGeneratorArgs,
  regenerationHint,
  renderProjection,
  sourceDigest,
  syncProjections,
} from "./generator-core.mjs";
import { createProjections, projectionSourcePaths } from "./generate.mjs";
import { OPERATIONS, resolveCommand } from "../../packages/contracts/script/cli/operations.mjs";
import {
  agentRouteRegistrations,
  collectRenderableAddresses,
  deploymentAddressFields,
  isRecordedAddress,
  isRecordedDeploymentValue,
  packageExports,
  publicAgentRoutes,
  publicAgentRouteSources,
  readJson,
  routeConstants,
  routineConnectors,
  selectSafeDeploymentFields,
  selectSafeFields,
  supportedChainIds,
  workflowInventory,
  workflowSourcePaths,
} from "./source-readers.mjs";
import {
  COMMAND_MANIFEST_ORDER,
  assignDataModelGroups,
  assignOperationGroups,
  assignTaskGroups,
  copyCommand,
  glossaryEverydayEntries,
  integrationNetworkRecords,
  mutationBoundaryLabel,
  orderCommandManifests,
  renderPackageExports,
  renderSkills,
  stateLabel,
} from "./renderers.mjs";
import { parseGlossaryAnchors } from "../quality/check-ontology.mjs";
import { EXPECTED_MUTATION_BOUNDARIES } from "../quality/task-routing-contract.mjs";
import { selectExpectedWorkflows } from "../quality/select-validation.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "green-goods-docs-generator-"));
  mkdirSync(path.join(root, "docs/docs/builders/reference"), { recursive: true });
  mkdirSync(path.join(root, "sources"), { recursive: true });
  writeFileSync(path.join(root, "sources/a.txt"), "alpha\r\n");
  writeFileSync(path.join(root, "sources/b.txt"), "beta\n\n");
  return root;
}

function projection() {
  return {
    scope: "qa",
    output: "docs/docs/builders/reference/generated.mdx",
    sources: ["sources/b.txt", "sources/a.txt"],
    render: ({ sources, digest }) =>
      `${generatedFrontmatter({ title: "Fixture", slug: "/fixture", sources, digest })}# Fixture\n`,
  };
}

test("normalizes line endings and hashes sources in stable path order", () => {
  const root = fixture();
  try {
    const first = sourceDigest(root, ["sources/b.txt", "sources/a.txt"]);
    writeFileSync(path.join(root, "sources/a.txt"), "alpha\n\n\n");
    const second = sourceDigest(root, ["sources/a.txt", "sources/b.txt"]);
    assert.equal(first, second);
    assert.equal(normalizeText("a\r\n\r\n"), "a\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fails closed for a missing authority file", () => {
  const root = fixture();
  try {
    assert.throws(() => sourceDigest(root, ["sources/missing.txt"]), /Missing generated authority source/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects malformed JSON authority data", () => {
  const root = fixture();
  try {
    writeFileSync(path.join(root, "sources/bad.json"), "{nope");
    assert.throws(() => readJson(root, "sources/bad.json"), /Malformed JSON authority/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("projects only allowlisted safe configuration fields", () => {
  assert.deepEqual(selectSafeFields({ address: "0x1", ignored: "no" }, ["address"]), {
    address: "0x1",
  });
  assert.throws(() => selectSafeFields({ apiKey: "secret" }, ["apiKey"]), /Unsafe configuration field/);
});

test("accepts only valid deployment addresses and treats zero as absent", () => {
  const address = "0x1111111111111111111111111111111111111111";
  const zero = "0x0000000000000000000000000000000000000000";
  assert.deepEqual(selectSafeDeploymentFields({ module: address }, ["module"]), { module: address });
  assert.equal(isRecordedAddress(address), true);
  assert.equal(isRecordedAddress(zero), false);
  assert.throws(
    () => selectSafeDeploymentFields({ module: "not-an-address" }, ["module"]),
    /Malformed deployment address/,
  );
  // A field may be a path into the artifact; a path through an operator identity is refused.
  const nested = { unlock: { managerDefaults: [address], locks: { genesis: { address } } } };
  assert.deepEqual(
    selectSafeDeploymentFields(nested, ["unlock.locks.genesis.address", "unlock.locks.firstWork.address"]),
    { "unlock.locks.genesis.address": address },
  );
  assert.throws(() => selectSafeDeploymentFields(nested, ["unlock.managerDefaults"]), /Unsafe configuration field/);
  // A schema registration is recorded as a UID, and only a field named for one may hold it.
  const uid = `0x${"ab".repeat(32)}`;
  assert.deepEqual(selectSafeDeploymentFields({ schemas: { workSchemaUID: uid } }, ["schemas.workSchemaUID"]), {
    "schemas.workSchemaUID": uid,
  });
  assert.throws(() => selectSafeDeploymentFields({ module: uid }, ["module"]), /Malformed deployment address/);
  assert.throws(
    () => selectSafeDeploymentFields({ schemas: { workSchemaUID: address } }, ["schemas.workSchemaUID"]),
    /Malformed deployment schema UID/,
  );
  assert.equal(isRecordedDeploymentValue(uid), true);
  assert.equal(isRecordedDeploymentValue(`0x${"0".repeat(64)}`), false);
  assert.equal(isRecordedDeploymentValue(address), true);
});

test("an integration is deployed only when every field it declares is recorded", () => {
  const root = fixture();
  try {
    const address = "0x1111111111111111111111111111111111111111";
    const zero = "0x0000000000000000000000000000000000000000";
    const deployments = "packages/contracts/deployments";
    mkdirSync(path.join(root, deployments), { recursive: true });
    mkdirSync(path.join(root, "packages/indexer"), { recursive: true });
    writeFileSync(
      path.join(root, deployments, "networks.json"),
      JSON.stringify({ networks: { staged: { chainId: 1, name: "Staged" }, complete: { chainId: 2, name: "Complete" } } }),
    );
    writeFileSync(path.join(root, "packages/indexer/config.yaml"), "contracts:\n  - name: Registry\n");
    // The registry is recorded on both networks; only the second has the lock and the schema it
    // depends on.
    const uid = (digit) => `0x${digit.repeat(64)}`;
    writeFileSync(
      path.join(root, deployments, "1-latest.json"),
      JSON.stringify({ registry: address, locks: { first: { address: zero } }, schemas: { firstSchemaUID: uid("0") } }),
    );
    writeFileSync(
      path.join(root, deployments, "2-latest.json"),
      JSON.stringify({ registry: address, locks: { first: { address } }, schemas: { firstSchemaUID: uid("c") } }),
    );
    const ontology = {
      integrations: [
        { id: "badges", display: "Badges", definition: "", deployment_fields: ["registry", "locks.first.address", "schemas.firstSchemaUID"], indexer_contracts: ["Registry"] },
      ],
    };
    const sources = [`${deployments}/1-latest.json`, `${deployments}/2-latest.json`, `${deployments}/networks.json`, "packages/indexer/config.yaml"];
    const { badges } = integrationNetworkRecords({ root, sources, ontology });
    assert.deepEqual(
      badges.networks.map((network) => [network.name, network.status, network.recorded]),
      [
        ["Staged", "Partial", ["registry"]],
        ["Complete", "Deployed", ["registry", "locks.first.address", "schemas.firstSchemaUID"]],
      ],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fails closed when any deployment artifact has a malformed address field", () => {
  const root = fixture();
  try {
    writeFileSync(
      path.join(root, "sources/a.json"),
      JSON.stringify({ module: "0x1111111111111111111111111111111111111111" }),
    );
    writeFileSync(path.join(root, "sources/b.json"), JSON.stringify({ module: "not-an-address" }));
    assert.throws(
      () => deploymentAddressFields(root, ["sources/a.json", "sources/b.json"]),
      /Malformed deployment address/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("derives supported chains and workflow sources deterministically", () => {
  const root = fixture();
  try {
    mkdirSync(path.join(root, ".github/workflows"), { recursive: true });
    writeFileSync(
      path.join(root, "sources/chains.ts"),
      "export const SUPPORTED_CHAINS = {\n  42161: {},\n  11155111: {},\n} as const;\n",
    );
    writeFileSync(path.join(root, ".github/workflows/z.yml"), "name: Z\n");
    writeFileSync(path.join(root, ".github/workflows/a.yaml"), "name: A\n");

    assert.deepEqual(supportedChainIds(root, "sources/chains.ts"), [42161, 11155111]);
    assert.deepEqual(workflowSourcePaths(root), [
      ".github/workflows/a.yaml",
      ".github/workflows/z.yml",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reads every public Agent route, however its path is written", () => {
  const root = fixture();
  try {
    mkdirSync(path.join(root, "sources/api/nested"), { recursive: true });
    writeFileSync(
      path.join(root, "sources/contract.ts"),
      [
        'export const ROUTES = {\n  subscribe: "/public/subscribe",\n  upload: "/api/uploads/sign",\n  orphan: "/public/orphan",\n} as const;',
        'export const AVATAR_ROUTE = "/public/avatars/:id" as const;',
        "export const AVATAR_LIMIT = 50;",
      ].join("\n"),
    );
    writeFileSync(
      path.join(root, "sources/api/routes.ts"),
      [
        "app.post(ROUTES.subscribe, handler);",
        "app.post(ROUTES.upload, handler);",
        "app.get(AVATAR_ROUTE, handler);",
        "app.get('/public/receipt/:id', handler);",
      ].join("\n"),
    );
    writeFileSync(
      path.join(root, "sources/api/nested/offers.ts"),
      [
        "// app.get('/public/commented-out', handler);",
        'const collection = "/public/offers";',
        "const record = `${collection}/:offerId`;",
        "for (const route of [collection, record]) {",
        "  app.options(route, preflight);",
        "}",
        "app.get(collection, list);",
        "app.put(record, save);",
      ].join("\n"),
    );
    writeFileSync(path.join(root, "sources/api/private.ts"), "app.use('/private/*', guard);\napp.get('/private', handler);\n");

    const contracts = ["sources/contract.ts"];
    // A route outside the public index must belong to a family the page names as left out.
    const unlisted = [{ prefixes: ["/private"], described: "the private routes" }];
    const sources = publicAgentRouteSources(root, "sources/api", contracts, unlisted);
    assert.deepEqual(sources, ["sources/api/nested/offers.ts", "sources/api/routes.ts"]);
    assert.throws(
      () => publicAgentRouteSources(root, "sources/api", contracts, []),
      /private\.ts: `\/private` is neither a public route nor in a route family the API Index names/,
    );
    assert.throws(
      () => publicAgentRouteSources(root, "sources/api", contracts, [{ prefixes: ["/private", "/gone/"], described: "" }]),
      /No Agent route is registered under `\/gone\/`/,
    );
    const offers = ["sources/api/nested/offers.ts"];
    const routes = ["sources/api/routes.ts"];
    assert.deepEqual(publicAgentRoutes(root, sources, contracts), [
      { path: "/api/uploads/sign", methods: ["POST"], constants: ["ROUTES.upload"], sources: routes },
      { path: "/public/avatars/:id", methods: ["GET"], constants: ["AVATAR_ROUTE"], sources: routes },
      { path: "/public/offers", methods: ["GET", "OPTIONS"], constants: [], sources: offers },
      { path: "/public/offers/:offerId", methods: ["OPTIONS", "PUT"], constants: [], sources: offers },
      // A contract path nobody registers keeps its row, so drift between the two is visible.
      { path: "/public/orphan", methods: [], constants: ["ROUTES.orphan"], sources: [] },
      { path: "/public/receipt/:id", methods: ["GET"], constants: [], sources: routes },
      { path: "/public/subscribe", methods: ["POST"], constants: ["ROUTES.subscribe"], sources: routes },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("refuses a route registration it cannot read instead of dropping it", () => {
  const root = fixture();
  try {
    mkdirSync(path.join(root, "sources/api"), { recursive: true });
    writeFileSync(path.join(root, "sources/contract.ts"), 'export const ROUTE = "/public/known";\n');
    const constants = routeConstants(root, ["sources/contract.ts"]);
    const reading = (code) => {
      writeFileSync(path.join(root, "sources/api/case.ts"), code);
      return () => agentRouteRegistrations(root, "sources/api/case.ts", constants);
    };
    assert.deepEqual(reading("app.get(ROUTE, handler);\n")(), [
      { source: "sources/api/case.ts", method: "GET", path: "/public/known" },
    ]);
    assert.throws(reading("app.get(UNKNOWN_ROUTE, handler);\n"), /cannot resolve the route path `UNKNOWN_ROUTE`/);
    assert.throws(reading("app.get(buildPath(1), handler);\n"), /cannot read the path argument of app\.get\(\)/);
    assert.throws(reading("app.all('/public/any', handler);\n"), /app\.all\(\) may register a route/);
    assert.throws(
      reading('const route = "/public/a";\nconst route = "/public/b";\napp.get(route, handler);\n'),
      /`route` is bound 2 times/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("API index lists every public path the Agent API and its route contracts write down", () => {
  const projection = createProjections(REPO_ROOT).find(
    (item) => item.output === "docs/docs/builders/packages/api-index.mdx",
  );
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  // An independent scan: a quoted `/public/...` path in the Agent API or a route contract is a
  // route, so each needs a row whichever way the Agent registers it.
  const agentApi = "packages/agent/src/api";
  const scanned = [
    ...readdirSync(path.join(REPO_ROOT, agentApi), { recursive: true })
      .filter((name) => name.endsWith(".ts"))
      .map((name) => `${agentApi}/${name}`),
    ...projection.sources.filter((source) => source.startsWith("packages/shared/src/public-contracts/")),
  ];
  const written = new Set();
  for (const source of scanned) {
    const text = readFileSync(path.join(REPO_ROOT, source), "utf8");
    for (const [, routePath] of text.matchAll(/["'`](\/public\/[^"'`$\s]+)["'`]/g)) written.add(routePath);
  }
  // The scan must reach a path that has no Shared constant, the case this test exists for.
  assert.ok(written.has("/public/gardens/:garden/join-requests"), [...written].join(", "));
  for (const routePath of written) {
    assert.ok(rendered.includes(`| \`${routePath}\` |`), `${routePath} is missing from the API Index`);
  }
  // The join-request and passkey groups are registered behind a startup condition.
  assert.match(rendered, /leaves a route group out at startup/);
  // The routes the index leaves out are named in one sentence, and none of their paths is a row.
  assert.match(rendered, /not public contracts, and this table leaves them out: .*`\/messaging\/`/);
  assert.doesNotMatch(rendered, /^\| `\/messaging\//m);
  // The saved-offer record route is built from a constant, so no file writes its path out.
  assert.match(
    rendered,
    /^\| `\/public\/saved-offers\/:savedOfferId` \| `DELETE`, `GET`, `OPTIONS`, `PUT` \| none \| `routes\/saved-offer-records\.ts` \|$/m,
  );
});

test("a field recorded on another network counts for the network that depends on it", () => {
  const root = fixture();
  try {
    const address = "0x1111111111111111111111111111111111111111";
    const zero = "0x0000000000000000000000000000000000000000";
    const deployments = "packages/contracts/deployments";
    mkdirSync(path.join(root, deployments), { recursive: true });
    mkdirSync(path.join(root, "packages/indexer"), { recursive: true });
    writeFileSync(
      path.join(root, deployments, "networks.json"),
      JSON.stringify({ networks: { home: { chainId: 1, name: "Home" }, rollup: { chainId: 2, name: "Rollup" }, testnet: { chainId: 3, name: "Testnet" } } }),
    );
    writeFileSync(path.join(root, "packages/indexer/config.yaml"), "contracts: []\n");
    const write = (chainId, artifact) => writeFileSync(path.join(root, deployments, `${chainId}-latest.json`), JSON.stringify(artifact));
    // The rollup holds the outbox, the home chain receives for it, and the testnet keeps both ends.
    write(2, { outbox: address, receiver: zero });
    write(3, { outbox: address, receiver: address });
    const ontology = {
      integrations: [
        { id: "names", display: "Names", definition: "", deployment_fields: ["receiver", "outbox"], remote_deployment_fields: { receiver: { 2: 1 } }, indexer_contracts: [] },
      ],
    };
    const sources = [1, 2, 3].map((chainId) => `${deployments}/${chainId}-latest.json`).concat(`${deployments}/networks.json`, "packages/indexer/config.yaml");
    const networks = () => integrationNetworkRecords({ root, sources, ontology }).names.networks;

    write(1, { outbox: zero, receiver: address });
    assert.deepEqual(networks(), [
      { chainId: 2, name: "Rollup", status: "Deployed", recorded: ["receiver", "outbox"], remote: { receiver: "Home" } },
      { chainId: 3, name: "Testnet", status: "Deployed", recorded: ["receiver", "outbox"] },
    ]);
    // Without its receiver the rollup is a staged deployment, and the home chain still has no row.
    write(1, { outbox: zero, receiver: zero });
    assert.deepEqual(networks()[0], { chainId: 2, name: "Rollup", status: "Partial", recorded: ["outbox"] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("MCP guide lists each connected service with the routines that declare it", () => {
  const projection = createProjections(REPO_ROOT).find((item) => item.output === "docs/docs/builders/agentic/mcp-guide.mdx");
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  const catalog = readJson(REPO_ROOT, "scripts/data/agent-connectors.json").connectors;
  const declared = routineConnectors(REPO_ROOT, projection.sources.filter((source) => source.startsWith("docs/routines/")));
  assert.ok(declared.size >= 4, "the routines declare connectors");
  for (const [connector, routines] of declared) {
    const row = rendered.split("\n").find((line) => line.startsWith(`| ${catalog[connector]?.display} |`));
    assert.ok(row, `${connector} has a row`);
    for (const routine of routines) assert.ok(row.includes(`\`${routine}\``), `${connector}: ${routine}`);
  }
  // The guide a row points at must be about that service, or the pointer teaches nothing.
  for (const [id, entry] of Object.entries(catalog)) {
    assert.match(readFileSync(path.join(REPO_ROOT, entry.rules), "utf8"), new RegExp(entry.display.split(" ").at(-1), "i"), id);
  }
});

test("routine connectors drop comments and refuse a list they cannot read", () => {
  const root = fixture();
  try {
    const routine = (name, list) => writeFileSync(path.join(root, `sources/${name}.md`), `---\nroutine-name: ${name}\nconnectors:\n${list}model: any\n---\n\n# Prompt\n`);
    routine("b-watch", "  - posthog  # read-only\n  - linear\n");
    routine("a-intake", "  - linear\n");
    assert.deepEqual([...routineConnectors(root, ["sources/b-watch.md", "sources/a-intake.md"])], [
      ["posthog", ["b-watch"]],
      ["linear", ["a-intake", "b-watch"]],
    ]);
    routine("odd", "  - Linear Cloud\n");
    assert.throws(() => routineConnectors(root, ["sources/odd.md"]), /unreadable connector entry: - Linear Cloud/);
    writeFileSync(path.join(root, "sources/bare.md"), "---\nconnectors:\n  - linear\n---\n");
    assert.throws(() => routineConnectors(root, ["sources/bare.md"]), /no readable routine-name and connectors list/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the economics explorer's data is computed from its model, with a value for every input in every preset", () => {
  const projection = createProjections(REPO_ROOT).find((item) => item.output === "docs/src/data/revenue-explorer.json");
  assert.ok(projection);
  const data = JSON.parse(renderProjection(REPO_ROOT, projection));
  assert.ok(data.sections.length > 0 && data.presets.length > 1);
  const fields = data.sections.flatMap((section) => section.fields);
  for (const preset of data.presets) {
    for (const field of fields) assert.equal(typeof preset.inputs[field.key], "number", `${preset.id}: ${field.key}`);
    // The outputs hold together the way the model defines them, so they were computed, not typed.
    const streams = preset.streams.reduce((sum, stream) => sum + stream.amount, 0);
    assert.ok(Math.abs(streams - preset.outputs.totalAnnualRevenue) < 1e-6, `${preset.id}: streams add up to revenue`);
    assert.ok(Math.abs(preset.outputs.totalAnnualRevenue - preset.outputs.totalExpenses - preset.outputs.netMargin) < 1e-6, `${preset.id}: margin`);
    // A preset that is not burning has no runway to run out; JSON carries that as null.
    if (preset.outputs.netMargin >= 0) assert.equal(preset.outputs.runwayMonths, null, preset.id);
  }
});

test("sorts package exports deterministically", () => {
  const root = fixture();
  try {
    writeFileSync(
      path.join(root, "sources/package.json"),
      JSON.stringify({ name: "fixture", exports: { "./z": "./z.js", ".": "./index.js" } })
    );
    assert.deepEqual(packageExports(root, ["sources/package.json"]).map((item) => item.specifier), [
      ".",
      "./z",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("package exports summarize a large package by group and keep a small one as one table", () => {
  const entry = (name, specifier) => ({ package: name, specifier, target: `./src${specifier.slice(1)}.ts` });
  const exports = [
    entry("@fixture/small", "./abis"),
    entry("@fixture/large", "."),
    entry("@fixture/large", "./toast"),
    ...Array.from({ length: 41 }, (_, index) => entry("@fixture/large", `./hooks/${index < 30 ? "garden" : "vault"}/use${index}`)),
    ...["a", "b", "c", "d"].map((name) => entry("@fixture/large", `./stores/${name}`)),
  ];
  const rendered = renderPackageExports(exports);
  assert.match(rendered, /^48 export specifiers across 2 packages\./);
  const [small, large] = rendered.split("### @fixture/large");
  assert.ok(small.includes("| `./abis` | `./src/abis.ts` |") && !small.includes("<details>"), "a small package is one table");
  // The summary counts each group, and groups under four specifiers share one row.
  for (const row of ["| `./hooks` | 41 |", "| `./stores` | 4 |", "| Other entry points | 2 |"]) assert.ok(large.includes(row), row);
  // Only a group over forty specifiers is split by its second segment.
  for (const label of ["**`./hooks/garden`** (30)", "**`./hooks/vault`** (11)"]) assert.ok(large.includes(label), label);
  assert.match(large, /<summary>`\.\/stores` \(4\)<\/summary>\n\n\| Specifier \| Target \|/);
  // Grouping loses nothing and repeats nothing.
  for (const item of exports) assert.equal(rendered.split(`| \`${item.specifier}\` | \`${item.target}\` |`).length - 1, 1, item.specifier);
});

test("detects missing, stale, and extra generated outputs", () => {
  const root = fixture();
  try {
    const item = projection();
    assert.deepEqual(syncProjections({ root, projections: [item], check: true }), [
      `missing: ${item.output}`,
    ]);
    assert.deepEqual(syncProjections({ root, projections: [item], check: false }), []);
    assert.deepEqual(syncProjections({ root, projections: [item], check: true }), []);

    writeFileSync(path.join(root, item.output), "modified\n");
    assert.deepEqual(syncProjections({ root, projections: [item], check: true }), [
      `stale: ${item.output}`,
    ]);

    const extra = path.join(root, "docs/docs/builders/reference/extra.mdx");
    writeFileSync(extra, "---\ngenerated: true\ngenerator: scripts/docs/generate.mjs\n---\n");
    assert.ok(syncProjections({ root, projections: [item], check: true }).includes("extra: docs/docs/builders/reference/extra.mdx"));

    mkdirSync(path.join(root, "docs/src/data"), { recursive: true });
    writeFileSync(path.join(root, "docs/src/data/retired.json"), '{"generator": "scripts/docs/generate.mjs"}\n');
    writeFileSync(path.join(root, "docs/src/data/hand-written.json"), '{"title": "not generated"}\n');
    const problems = syncProjections({ root, projections: [item], check: true });
    assert.ok(problems.includes("extra: docs/src/data/retired.json"), "a generated JSON file no projection owns is extra");
    assert.ok(!problems.some((problem) => problem.includes("hand-written.json")), "plain data files are not generator-owned");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fixture CLI exits nonzero for broken authority and modified output", () => {
  const root = fixture();
  try {
    const runner = path.join(root, "check.mjs");
    const core = new URL("./generator-core.mjs", import.meta.url).href;
    writeFileSync(
      runner,
      `import {syncProjections} from ${JSON.stringify(core)};\n` +
        `const root=${JSON.stringify(root)};\n` +
        `const projections=[{scope:"qa",output:"docs/docs/builders/reference/generated.mdx",sources:["sources/missing.txt"],render:()=>"x"}];\n` +
        `try { const problems=syncProjections({root,projections,check:true}); process.exit(problems.length ? 1 : 0); } catch { process.exit(2); }\n`
    );
    assert.throws(() => execFileSync(process.execPath, [runner]), (error) => error.status === 2);

    writeFileSync(path.join(root, "sources/missing.txt"), "source\n");
    writeFileSync(path.join(root, "docs/docs/builders/reference/generated.mdx"), "modified\n");
    assert.throws(() => execFileSync(process.execPath, [runner]), (error) => error.status === 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects malformed CLI input", () => {
  assert.throws(() => parseGeneratorArgs(["--scope", "unknown"]), /Unknown docs generator scope/);
  assert.throws(() => parseGeneratorArgs(["--wat"]), /Unknown docs generator argument/);
});

test("the generator's module graph imports with no packages installed, as CI Gate loads it", () => {
  // CI Gate runs the selector suite before any install, and that suite imports
  // scripts/docs/generate.mjs. A static package import anywhere in the graph fails the gate on
  // every pull request, and no local run sees it, because packages are installed here.
  const STATIC_IMPORT = /^\s*(?:import|export)\s+(?:[\w$*\s{},]+?\s+from\s+)?["']([^"']+)["']/gm;
  const seen = new Set();
  const packages = [];
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const [, specifier] of readFileSync(file, "utf8").matchAll(STATIC_IMPORT)) {
      if (specifier.startsWith("node:")) continue;
      if (specifier.startsWith(".")) visit(path.resolve(path.dirname(file), specifier));
      else packages.push(`${path.relative(REPO_ROOT, file)} imports ${specifier}`);
    }
  };
  visit(path.join(REPO_ROOT, "scripts/docs/generate.mjs"));
  assert.deepEqual(packages, [], "load a package where it is used (see parseYaml in source-readers.mjs), not at import time");
  assert.ok(seen.has(path.join(REPO_ROOT, "scripts/docs/source-readers.mjs")) && seen.size >= 6, "the walk followed the relative imports");
});

test("generated banners quote regeneration commands the generator accepts", () => {
  const integrationData = createProjections(REPO_ROOT).find(
    (item) => item.output === "docs/src/data/integration-projections.json",
  );
  assert.ok(integrationData);
  const banners = [
    generatedFrontmatter({ title: "Fixture", slug: "/fixture", sources: [], digest: "sha256:test" }),
    JSON.parse(renderProjection(REPO_ROOT, integrationData)).$generated,
  ];
  for (const banner of banners) {
    const commands = [...banner.matchAll(/`node scripts\/docs\/generate\.mjs([^`]*)`/g)].map((match) =>
      match[1].trim().split(/\s+/).filter(Boolean).map((word) => (word === "<scope>" ? "package" : word)),
    );
    assert.equal(commands.length, 2, `banner should quote the full and scoped commands: ${banner}`);
    for (const args of commands) assert.doesNotThrow(() => parseGeneratorArgs(args), `${args.join(" ")} must parse`);
  }
  assert.equal(parseGeneratorArgs(["--scope", "integration"]).scope, "integration");
  assert.match(regenerationHint("qa"), /--scope qa`\.$/);
});

test("data model grouping places every entity in exactly one group", () => {
  const groups = [
    { title: "One", members: ["a", "b"] },
    { title: "Two", members: ["c"] },
  ];
  assert.equal(assignDataModelGroups(["a", "b", "c"], groups).get("c"), "Two");
  assert.throws(
    () => assignDataModelGroups(["a", "b", "c"], [...groups, { title: "Three", members: ["b"] }]),
    /Listed in more than one group: b/,
  );
  assert.throws(() => assignDataModelGroups(["a", "b", "c", "d"], groups), /Unassigned entities: d/);
  assert.throws(() => assignDataModelGroups(["a", "b"], groups), /Unknown group members: c/);
});

test("every projection source is routed to the Docs workflow", () => {
  for (const source of projectionSourcePaths(REPO_ROOT)) {
    assert.ok(
      selectExpectedWorkflows({ changedPaths: [source], intent: "merge", ci: true }).includes("Docs"),
      `${source} must require the Docs workflow`,
    );
  }
});

test("personas page gives each persona a section, its journey, and the surfaces it works in", () => {
  const projection = createProjections(REPO_ROOT).find(
    (item) => item.output === "docs/docs/builders/architecture/personas.mdx",
  );
  assert.ok(projection);
  const sidecar = "packages/shared/src/ontology/green-goods-ontology.json";
  const projectionData = "packages/shared/src/ontology/green-goods-projections.json";
  assert.deepEqual(projection.sources, [sidecar, projectionData]);
  const rendered = renderProjection(REPO_ROOT, projection);
  assert.match(rendered, /^title: Personas and Surfaces$/m);
  assert.match(rendered, /^slug: \/builders\/architecture\/personas$/m);
  // Every persona has its own heading and a summary row that links to it.
  for (const persona of readJson(REPO_ROOT, sidecar).personas) {
    assert.ok(rendered.includes(`## ${persona.display} {#${persona.id}}`), persona.id);
    assert.ok(rendered.includes(`| [${persona.display}](#${persona.id}) |`), persona.id);
  }
  // "Works in" is the union of the surfaces the persona's own interactions name, not a naming rule.
  assert.match(rendered, /^\| \[Gardener\]\(#gardener\) \| [^|]+ \| Client app, Messaging agent \|$/m);
  // Every interaction in the projection data is on the page.
  for (const journey of readJson(REPO_ROOT, projectionData).persona_journeys) {
    for (const engagement of journey.engagements) {
      assert.ok(rendered.includes(`| ${engagement.when} | ${engagement.what}`), `${journey.ref}: ${engagement.when}`);
    }
  }
  // One that relies on a term people cannot use yet says so, and names no surface it does not have.
  assert.match(rendered, /Name a community need[^|]*\*Planned, not built yet\.\* \| — \|/);
});

test("glossary leads with plain entries for the everyday terms and keeps every anchor people link to", () => {
  const projection = createProjections(REPO_ROOT).find(
    (item) => item.output === "docs/docs/reference/glossary.generated.mdx",
  );
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  const section = (heading) => {
    const start = rendered.indexOf(`\n## ${heading}\n`);
    assert.ok(start >= 0, `missing section: ${heading}`);
    const end = rendered.indexOf("\n## ", start + 1);
    return { start, text: rendered.slice(start, end === -1 ? undefined : end) };
  };
  const everyday = section("Everyday terms");
  assert.doesNotMatch(rendered, /\| Term \| Type \|/);
  assert.doesNotMatch(rendered, /^## Domain Entities$/m);
  assert.match(rendered, /\/reference\/ontology#entities/);
  // The anchors packages/client/src/views/Public/Glossary.tsx deep-links land on plain entries.
  const appAnchors = ["action", "assessment", "cookie-jar", "evaluator", "garden", "gardener", "impact-certificate", "steward", "vault", "work"];
  for (const anchor of appAnchors) {
    assert.match(everyday.text, new RegExp(`^### .+ \\{#${anchor}\\}$`, "m"), anchor);
  }
  // An entry is the term's plain-language record. Its formal definition stays in the tables.
  const sidecar = readJson(REPO_ROOT, "packages/shared/src/ontology/green-goods-ontology.json");
  const projectionData = readJson(REPO_ROOT, "packages/shared/src/ontology/green-goods-projections.json");
  const garden = sidecar.entities.find((entity) => entity.id === "garden");
  const gardenConcept = projectionData.human_concepts.find((concept) => concept.ref === "entity:garden");
  assert.ok(everyday.text.includes(`**${gardenConcept.plain_name}.**`));
  assert.ok(everyday.text.includes(gardenConcept.example));
  assert.ok(!everyday.text.includes(garden.definition));
  assert.ok(!rendered.includes(garden.definition));
  // A term has one heading on the page, so no anchor is defined twice.
  assert.equal((rendered.match(/^### Garden \{#garden\}$/gm) ?? []).length, 1);
  const anchors = [...rendered.matchAll(/\{#([a-z0-9-]+)\}|<a id="([a-z0-9-]+)"><\/a>|<TermAnchor id="([a-z0-9-]+)" \/>/g)].map((match) => match[1] ?? match[2] ?? match[3]);
  assert.equal(new Set(anchors).size, anchors.length, "duplicate anchor on the glossary page");
  // Every term keeps an anchor: canonical entities, personas, supporting terms, and the old aliases.
  const expected = [
    ...sidecar.entities.filter((entity) => entity.semantic_status === "canonical").map((entity) => entity.id),
    ...sidecar.personas.map((persona) => persona.id),
    ...sidecar.supporting_terms.map((term) => term.id),
    "operator",
    "pwa-progressive-web-app",
    "smart-account-account-abstraction",
  ];
  for (const id of expected) assert.ok(anchors.includes(id), `anchor lost: ${id}`);
  const published = JSON.parse(readFileSync(new URL("./fixtures/glossary-public-anchors.json", import.meta.url), "utf8"));
  for (const id of published) assert.ok(parseGlossaryAnchors(rendered).has(id), `published anchor lost: ${id}`);
});

test("an everyday glossary entry needs a plain-language record and a name the ontology knows", () => {
  const ontology = {
    entities: [{ id: "garden", display: "Garden", definition: "Formal.", semantic_status: "canonical" }],
    personas: [],
  };
  const projections = {
    capabilities: [{ ref: "entity:garden", availability: "in-build" }],
    human_concepts: [
      { ref: "entity:garden", plain_name: "A community", why_it_matters: "Why.", example: "An example.", aliases: ["community garden"], not_confused_with: ["a wallet"] },
    ],
  };
  const [entry] = glossaryEverydayEntries(ontology, projections, [{ ref: "entity:garden", heading: "Community Garden", guide: ["Join", "/join"] }]);
  assert.equal(entry.heading, "Community Garden");
  assert.equal(entry.anchor, "community-garden");
  // The canonical id stays reachable when the heading is an alias.
  assert.deepEqual(entry.aliasAnchors, ["garden"]);
  assert.deepEqual(entry.alsoCalled, ["Garden"]);
  assert.equal(entry.availabilityNote, "Still being built.");
  assert.throws(
    () => glossaryEverydayEntries(ontology, projections, [{ ref: "entity:vault", guide: ["Endow", "/endow"] }]),
    /entity:vault is not a canonical entity or persona/,
  );
  assert.throws(
    () => glossaryEverydayEntries(ontology, { ...projections, human_concepts: [] }, [{ ref: "entity:garden", guide: ["Join", "/join"] }]),
    /entity:garden has no human concept/,
  );
  assert.throws(
    () => glossaryEverydayEntries(ontology, projections, [{ ref: "entity:garden", heading: "Plot", guide: ["Join", "/join"] }]),
    /"Plot" is neither the display name nor a declared alias of entity:garden/,
  );
});

test("data model projects layered diagrams, every relationship, and all lifecycles", () => {
  const projection = createProjections(REPO_ROOT).find(
    (item) => item.output === "docs/docs/builders/architecture/data-model.mdx",
  );
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  const blocks = [...rendered.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((match) => match[1]);
  const ontology = readJson(REPO_ROOT, "packages/shared/src/ontology/green-goods-ontology.json");
  const flowcharts = blocks.filter((block) => block.startsWith("flowchart"));
  const machines = blocks.filter((block) => block.startsWith("stateDiagram-v2"));
  assert.equal(flowcharts.length, 3);
  assert.equal(machines.length, ontology.state_machines.length);
  assert.match(rendered, /## Lifecycles/);
  const memberCount = (blocks.join("\n").match(/\]:::member/g) ?? []).length;
  assert.equal(memberCount, ontology.entities.length);
  const expectedEdges = ontology.entities.reduce(
    (sum, entity) => sum + (entity.relationships ?? []).length,
    0,
  );
  const renderedEdges = flowcharts.join("\n").split("\n").filter((line) => line.includes("-->")).length;
  assert.equal(renderedEdges, expectedEdges);
  assert.match(flowcharts[0], /garden\[[^\]]*\]:::member/);
  assert.doesNotMatch(flowcharts[0], /commitment_pool\[[^\]]*\]:::member/);
  assert.match(flowcharts[2], /commitment_pool\[[^\]]*\]:::member/);
  // Mermaid ends a state-diagram label at `;` or `:`; a long label is unreadable on the arrow.
  const arrowLines = machines.flatMap((block) => block.split("\n").filter((line) => line.includes("-->")));
  const expectedArrows = ontology.state_machines.reduce(
    (sum, machine) => sum + machine.transitions.reduce((inner, t) => inner + t.from.length * t.to.length, 0),
    0,
  );
  assert.equal(arrowLines.length, expectedArrows);
  for (const line of arrowLines) assert.match(line, /^ {2}\w+ --> \w+: [^;:]{1,61}$/, line);
  for (const machine of ontology.state_machines) {
    const section = rendered.slice(rendered.indexOf(`### ${machine.id} {#${machine.id}}`));
    const table = section.slice(section.indexOf("| From | To | Layer | Mechanism |"), section.indexOf("\n\n", section.indexOf("| From |")));
    assert.equal(table.split("\n").length - 2, machine.transitions.length, `${machine.id} mechanism rows`);
  }
});

test("state labels keep the first clause, drop detail past the cap, and never carry `;` or `:`", () => {
  assert.equal(stateLabel("claimCommitment → CommitmentAccepted; the pool records the claim"), "claimCommitment → CommitmentAccepted");
  assert.equal(stateLabel("recordRepayment clearing the balance → LoanRepaid(recoveredFromDefault = true); default is not terminal"), "recordRepayment clearing the balance → LoanRepaid");
  assert.equal(stateLabel("a label with a colon: detail"), "a label with a colon- detail");
  const long = stateLabel("x".repeat(80));
  assert.equal(long.length, 60);
  assert.ok(long.endsWith("…"));
  assert.equal(stateLabel("first sentence. second sentence"), "first sentence");
  assert.equal(stateLabel("one — two"), "one");
});

test("skills catalog prefers a skill README and falls back to the SKILL.md description", () => {
  const root = fixture();
  try {
    mkdirSync(path.join(root, ".claude/skills/alpha"), { recursive: true });
    mkdirSync(path.join(root, ".claude/skills/beta"), { recursive: true });
    writeFileSync(
      path.join(root, ".claude/skills/alpha/SKILL.md"),
      "---\nname: alpha\ndescription: Alpha description sentence.\n---\nBody\n",
    );
    writeFileSync(
      path.join(root, ".claude/skills/alpha/README.md"),
      "# Alpha\n\nAlpha readme purpose paragraph.\n\n**When to use it:** When alpha applies.\n\n" +
        "**What you get:** An alpha result.\n\n**How to invoke:** Type `/alpha`.\n\n## More\n\nDetail\n",
    );
    writeFileSync(
      path.join(root, ".claude/skills/beta/SKILL.md"),
      "---\nname: beta\ndescription: Beta description sentence.\n---\nBody\n",
    );
    const sources = [
      ".claude/skills/alpha/README.md",
      ".claude/skills/alpha/SKILL.md",
      ".claude/skills/beta/SKILL.md",
    ];
    const rendered = renderSkills({ root, sources, digest: "sha256:test" });
    assert.match(rendered, /## alpha \{#alpha\}\n\nAlpha readme purpose paragraph\./);
    assert.match(
      rendered,
      /- \*\*When to use it:\*\* When alpha applies\.\n- \*\*What you get:\*\* An alpha result\.\n- \*\*How to invoke:\*\* Type `\/alpha`\./,
    );
    assert.doesNotMatch(rendered, /Alpha description sentence\./);
    assert.match(rendered, /## beta \{#beta\}\n\nBeta description sentence\./);
    assert.doesNotMatch(rendered, /^### /m, "skill headings sit directly under the page title");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("skills catalog projects every repository skill", () => {
  const projection = createProjections(REPO_ROOT).find(
    (item) => item.output === "docs/docs/builders/agentic/skills.mdx",
  );
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  const skills = readdirSync(path.join(REPO_ROOT, ".claude/skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  assert.ok(skills.length > 0);
  for (const skill of skills) {
    const start = rendered.indexOf(`## ${skill} {#${skill}}`);
    assert.notEqual(start, -1, `${skill} must have a catalog entry`);
    const next = rendered.indexOf("\n## ", start + 1);
    const entry = rendered.slice(start, next === -1 ? undefined : next);
    for (const label of ["When to use it", "What you get", "How to invoke"]) {
      assert.ok(entry.includes(`- **${label}:**`), `${skill} must say ${label} (add it to its README)`);
    }
  }
  assert.match(rendered, /tree\/develop\/\.claude\/skills\/research/);
  assert.ok(rendered.indexOf("## Catalog") < rendered.indexOf(`## ${skills[0]} {#`));
  assert.equal((rendered.match(/^\| \[[a-z-]+\]\(#[a-z-]+\) \| /gm) ?? []).length, skills.length);
});

test("integration projections move to one data file with per-network and indexing facts", () => {
  const projections = createProjections(REPO_ROOT);
  assert.ok(
    !projections.some((item) => item.output === "docs/docs/builders/integrations/hats.mdx"),
    "per-integration MDX projections should be retired in favor of the data file",
  );
  const projection = projections.find(
    (item) => item.output === "docs/src/data/integration-projections.json",
  );
  assert.ok(projection);
  const payload = JSON.parse(renderProjection(REPO_ROOT, projection));
  assert.deepEqual(Object.keys(payload.integrations), [
    "cookie-jar",
    "eas",
    "ens",
    "gardens",
    "hats",
    "hypercerts",
    "karma",
    "octant",
    "tokenbound",
    "unlock",
  ]);
  assert.ok(
    payload.integrations.eas.networks.some((network) => network.recorded.includes("workApprovalResolver")),
    "the EAS projection records the Green Goods resolvers a network deployed",
  );
  const hats = payload.integrations.hats;
  assert.ok(
    hats.networks.some(
      (network) => network.chainId === 42161 && network.recorded.includes("hatsModule"),
    ),
  );
  assert.ok(Array.isArray(hats.indexedContracts));
  // GreenWill issues nothing without its locks, so the Unlock record counts them with the registry.
  const unlock = payload.integrations.unlock.networks.find((network) => network.chainId === 42161);
  assert.equal(unlock.status, "Deployed");
  assert.deepEqual(unlock.recorded, [
    "greenWill",
    "unlock.factory",
    "unlock.locks.genesis.address",
    "unlock.locks.firstWork.address",
    "unlock.locks.firstSupport.address",
  ]);
  // ENS is cross-chain: Arbitrum's receiver is recorded on Ethereum, which gets no row of its own.
  const ens = payload.integrations.ens.networks;
  assert.deepEqual(ens.find((network) => network.chainId === 42161).remote, { ensReceiver: "Ethereum Mainnet" });
  assert.equal(ens.some((network) => network.chainId === 1), false);
  assert.equal(typeof payload.digest, "string");
  assert.ok(hats.totalNetworks >= hats.networks.length);
});

test("guided journeys keep each handoff and known gate beside its Test ID", () => {
  const projection = createProjections(REPO_ROOT).find(
    (item) => item.output === "docs/docs/builders/quality/test-cases.mdx",
  );
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  const catalog = readJson(REPO_ROOT, "scripts/data/qa-test-catalog.json");
  const escapeMarkdown = (value) => String(value).replaceAll("|", "\\|").replaceAll("`", "&#96;");

  for (const journey of catalog.journeys) {
    let stepNumber = 0;
    for (const [index, step] of journey.steps.entries()) {
      stepNumber += 1;
      const start = rendered.indexOf(`${stepNumber}. \`${step.caseId}\``);
      assert.notEqual(start, -1, `${step.caseId} must be rendered in journey order`);
      const nextStep = journey.steps[index + 1];
      const nextStart = nextStep
        ? rendered.indexOf(`${stepNumber + 1}. \`${nextStep.caseId}\``, start)
        : rendered.indexOf("\n### ", start);
      const section = rendered.slice(start, nextStart === -1 ? undefined : nextStart);

      if (step.handoff) {
        assert.ok(
          section.includes(`- **Handoff:** ${escapeMarkdown(step.handoff)}`),
          `${step.caseId} must retain its handoff`,
        );
      }
      if (step.knownGate) {
        assert.ok(
          section.includes(`- **Known gate:** ${escapeMarkdown(step.knownGate)}`),
          `${step.caseId} must retain its known gate`,
        );
      }
    }
  }
});

test("task routing projects public ownership and one-way synchronization", () => {
  const projection = createProjections(REPO_ROOT).find(
    (item) => item.output === "docs/docs/builders/agentic/task-routing.mdx",
  );
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  assert.match(rendered, /## Ownership and synchronization/);
  assert.match(rendered, /plan_hubs -->\|mirrors visibility\| linear/);
  assert.match(rendered, /qa_catalog -->\|defines runs\| private_qa_evidence/);
  assert.doesNotMatch(rendered, /PRD-\d+|In Progress|authenticated Vercel/);
});

test("command inventory reads root first, then packages in contributor order, then docs, with copyable cells", () => {
  const projection = createProjections(REPO_ROOT).find((item) => item.output === "docs/docs/builders/packages/commands.mdx");
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  assert.equal(rendered.includes("Removed command replacements"), false, "retired names stay out of the inventory");
  const headings = [...rendered.matchAll(/^## (.+?) \(\d+\)$/gm)].map((match) => match[1]);
  assert.deepEqual(headings, [
    "Repository root",
    "packages/client",
    "packages/admin",
    "packages/agent",
    "packages/shared",
    "packages/indexer",
    "packages/contracts",
    "packages/qa",
    "docs",
  ]);
  assert.equal((rendered.match(/^import \{CopyCommand\} from "@site\/src\/components\/docs";$/gm) ?? []).length, 1);
  assert.ok(rendered.includes('<CopyCommand command="bun run --cwd docs build" />'));
  assert.throws(() => orderCommandManifests(COMMAND_MANIFEST_ORDER.slice(1)), /Missing manifests: package.json/);
  assert.throws(() => orderCommandManifests([...COMMAND_MANIFEST_ORDER, "packages/new/package.json"]), /Unlisted manifests/);
});

test("copyable commands encode the characters MDX attributes and table cells cannot carry", () => {
  assert.equal(
    copyCommand('bun run x -- --sender <addr> && echo "a|b"'),
    '<CopyCommand command="bun run x -- --sender &lt;addr&gt; &amp;&amp; echo &quot;a&#124;b&quot;" />',
  );
  assert.throws(() => copyCommand("bun run a\nbun run b"), /cannot span lines/);
});

function jsonFilesUnder(directory) {
  const files = [];
  const visit = (relative) => {
    for (const entry of readdirSync(path.join(REPO_ROOT, relative), { withFileTypes: true })) {
      const child = `${relative}/${entry.name}`;
      if (entry.isDirectory()) visit(child);
      else if (entry.name.endsWith(".json")) files.push(child);
    }
  };
  visit(directory);
  return files;
}

test("deployments page links every recorded address and schema UID and keeps operator identities off it", () => {
  const projection = createProjections(REPO_ROOT).find((item) => item.output === "docs/docs/builders/reference/deployments.mdx");
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  const arbitrum = readJson(REPO_ROOT, "packages/contracts/deployments/42161-latest.json");
  assert.match(rendered, /^title: Deployments & Addresses$/m);
  assert.ok(rendered.indexOf("## Arbitrum One (42161)") < rendered.indexOf("## Celo (42220)"));
  assert.ok(rendered.includes(`<CopyCommand command="${arbitrum.workApprovalResolver}" />`));
  assert.ok(rendered.includes(`[arbiscan.io](https://arbiscan.io/address/${arbitrum.workApprovalResolver})`));
  assert.ok(rendered.includes(`https://arbitrum.easscan.org/schema/view/${arbitrum.schemas.workSchemaUID}`));
  assert.ok(rendered.includes("| Commitment pooling module (proxy) |"));
  assert.ok(rendered.includes("| Commitment pooling module (implementation) |"));
  assert.ok(rendered.includes("| ERC-6551 account proxy |"));
  assert.ok(rendered.includes("| GreenWill badge registry |"));
  assert.doesNotMatch(rendered, /^\| [a-z][A-Za-z0-9]* \|/m, "no raw artifact key is used as a label");
  assert.match(rendered, /Recorded as the zero address on this network: [^\n]*`ensReceiver`/);

  // Any hex value stored under an operator, receipt, or safe path must stay off the page unless
  // the same value is also a listed contract.
  const OPERATIONAL = /(owner|deployer|^manager|managers|safe|multisig|sender|signer|deploymentDefaults|releaseReceipts|boundaries|transactionHash|blockHash|validator|authorizedIssuer)/i;
  const hidden = new Set();
  const walk = (value, segments) => {
    if (Array.isArray(value)) value.forEach((item) => walk(item, segments));
    else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) walk(child, [...segments, key]);
    else if (typeof value === "string" && /^0x[a-fA-F0-9]{40}$|^0x[a-fA-F0-9]{64}$/.test(value) && segments.some((segment) => OPERATIONAL.test(segment))) {
      hidden.add(value.toLowerCase());
    }
  };
  for (const file of jsonFilesUnder("packages/contracts/deployments")) walk(readJson(REPO_ROOT, file), []);
  assert.ok(hidden.size > 0, "the artifacts carry operator data this test guards");
  const listed = new Set(
    projection.sources
      .filter((source) => /deployments\/\d+-latest\.json$/.test(source))
      .flatMap((source) => collectRenderableAddresses(readJson(REPO_ROOT, source)).map((entry) => entry.value.toLowerCase())),
  );
  const page = rendered.toLowerCase();
  const leaks = [...hidden].filter((value) => !listed.has(value) && page.includes(value));
  assert.deepEqual(leaks, []);
  for (const receipt of Object.values(arbitrum.releaseReceipts ?? {})) assert.equal(page.includes(receipt.transactionHash.toLowerCase()), false);
});

test("renderable deployment addresses stop at the allowlist and the blocked field names", () => {
  const entries = collectRenderableAddresses(readJson(REPO_ROOT, "packages/contracts/deployments/42161-latest.json"));
  const keys = entries.map((entry) => entry.key);
  assert.ok(keys.includes("eas.address"));
  assert.ok(keys.includes("schemas.workSchemaUID"));
  assert.ok(keys.includes("transferManager"));
  assert.ok(keys.some((key) => key.startsWith("unlock.locks.")));
  assert.equal(keys.some((key) => /greenWillConfig|managerDefaults|owner|deployer/i.test(key)), false);
  assert.throws(() => selectSafeFields({ owner: "0x" }, ["owner"]), /Unsafe/);
  assert.throws(() => selectSafeFields({ deployer: "0x" }, ["deployer"]), /Unsafe/);
  assert.throws(() => selectSafeFields({ managerDefaults: "0x" }, ["managerDefaults"]), /Unsafe/);
  assert.throws(() => selectSafeFields({ badgeLockManagers: "0x" }, ["badgeLockManagers"]), /Unsafe/);
  assert.doesNotThrow(() => selectSafeFields({ transferManager: "x" }, ["transferManager"]));
});

test("entity matrix derives integration status from the catalog and the artifacts", () => {
  const projection = createProjections(REPO_ROOT).find((item) => item.output === "docs/docs/builders/architecture/entity-matrix.mdx");
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  assert.equal(rendered.includes("Active integrations"), false);
  // Every column is a protocol the code integrates with, so none reads as a vocabulary-only mapping.
  assert.equal(/Vocabulary mapping only|Columns without a code integration/.test(rendered), false);
  assert.match(rendered, /^\| EAS \| \[EAS\]\(\/builders\/integrations\/eas\) \| [^|]*Arbitrum One \(Deployed\)/m);
  assert.match(rendered, /^\| ENS \| \[ENS\]\(\/builders\/integrations\/ens\) \| [^|]*Sepolia Testnet \(Deployed\)/m);
  assert.match(rendered, /^\| Unlock \| \[Unlock Protocol\]\(\/builders\/integrations\/unlock\) \| Arbitrum One \(Deployed\) \| 1 \|$/m);
  assert.ok(rendered.indexOf("### Karma GAP") < rendered.indexOf("| Garden | Project | Entity |"));
  assert.ok(rendered.indexOf("### Tokenbound") < rendered.indexOf("| Garden | Token-bound account (ERC-6551) | Entity |"));
  // Each of the five personas has its own rows; the merged and non-canonical rows are gone.
  for (const persona of ["Gardener", "Steward", "Evaluator", "Funder", "Community Member"]) {
    assert.match(rendered, new RegExp(`^\\| ${persona} \\| [^|]+ \\| Persona \\|$`, "m"), persona);
  }
  assert.equal(/Funder\/Evaluator|Data Scientist|TAM /.test(rendered), false);
  assert.equal(/^\| Green Goods \| Karma GAP \| Hypercerts \|/m.test(rendered), false, "the wide grid is gone");
});

test("workflow catalog covers every workflow file, only CI Gate is required, and the page explains each run", () => {
  const catalog = readJson(REPO_ROOT, "scripts/data/workflow-catalog.json").workflows;
  assert.deepEqual(Object.keys(catalog).sort(), workflowSourcePaths(REPO_ROOT));
  assert.deepEqual(Object.entries(catalog).filter(([, entry]) => entry.required).map(([source]) => source), [".github/workflows/ci-gate.yml"]);
  for (const [source, entry] of Object.entries(catalog)) {
    assert.ok(entry.purpose.trim().length > 20, `${source} purpose`);
    assert.ok(entry.useCase.trim().length > 10, `${source} use case`);
  }
  const projection = createProjections(REPO_ROOT).find((item) => item.output === "docs/docs/builders/quality/gh-actions.mdx");
  const rendered = renderProjection(REPO_ROOT, projection);
  assert.match(rendered, /^\| \[CI Gate\]\(#ci-gate\) \| [^|]+\| every pull request \| Yes \|$/m);
  assert.match(rendered, /^### Contracts Nightly \{#contracts-nightly\}$/m);
  assert.ok(rendered.includes("`17 3 * * *` UTC"));
  assert.ok(rendered.includes('<CopyCommand command="bun run test" />'));
  // The gate's wait set comes from the policy, so a scheduled or manual workflow never claims it.
  const section = (heading) => rendered.slice(rendered.indexOf(`### ${heading} {#`)).split("\n### ")[0];
  assert.match(section("Docs"), /Required status:\*\* no, but the CI Gate waits for it on a pull request that touches its paths\./);
  for (const heading of ["Contracts Nightly", "Contracts Manual", "Coverage Nightly", "Release"]) {
    assert.match(section(heading), /Required status:\*\* no, and the CI Gate never waits for it/, heading);
  }
  assert.match(section("CI Gate"), /Required status:\*\* yes, branch protection waits for it\./);
});

test("workflow inventory reads display name, sorted jobs, and triggers from the YAML", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "green-goods-workflow-inventory-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, ".github/workflows"), { recursive: true });
  writeFileSync(
    path.join(root, ".github/workflows/x.yml"),
    'name: Example\non:\n  push:\n    branches: [main]\n    paths:\n      - "a/**"\n  pull_request:\n  schedule:\n    - cron: "1 2 * * *"\n  workflow_dispatch: {}\njobs:\n  b:\n    runs-on: ubuntu-latest\n  a:\n    runs-on: ubuntu-latest\n',
  );
  const [workflow] = workflowInventory(root, [".github/workflows/x.yml"]);
  assert.equal(workflow.display, "Example");
  assert.deepEqual(workflow.jobs, ["a", "b"]);
  assert.deepEqual(workflow.triggers.push.branches, ["main"]);
  assert.deepEqual(workflow.triggers.push.paths, ["a/**"]);
  assert.deepEqual(workflow.triggers.pull_request.paths, []);
  assert.deepEqual(workflow.triggers.schedule.crons, ["1 2 * * *"]);
  assert.ok("workflow_dispatch" in workflow.triggers);
});

test("every copied contract command resolves once its placeholders are filled", () => {
  // A row a reader copies has to be a complete command: with a network and mode from its own row
  // and a value for each placeholder, the CLI's own resolver must accept it. The samples only need
  // the right shape, and a new required value without one fails here on purpose.
  const SAMPLE = { "expected-nonce": "1", step: "1", commit: "a".repeat(40), receipt: `0x${"a".repeat(64)}` };
  const projection = createProjections(REPO_ROOT).find((item) => item.output === "docs/docs/builders/packages/contract-operations.mdx");
  const rendered = renderProjection(REPO_ROOT, projection);
  const decode = (text) => text.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#124;", "|").replaceAll("&amp;", "&");
  const rows = [...rendered.matchAll(/<CopyCommand command="bun run contracts -- ([^"]+)" \/>/g)].map(([, command]) => decode(command));
  assert.equal(rows.length, OPERATIONS.length, "one copied command per operation");
  const stuck = [];
  for (const row of rows) {
    const [operation] = OPERATIONS.filter((item) => row === item.command || row.startsWith(`${item.command} `)).sort((a, b) => b.command.length - a.command.length);
    assert.ok(operation, `no operation for: ${row}`);
    const words = row.split(" ");
    const fill = (network, mode) => {
      let flag = null;
      return words.map((word) => {
        if (word.startsWith("--")) {
          flag = word.slice(2);
          return word;
        }
        if (word === "<network>") return network;
        if (word === "<mode>") return mode;
        if (word === "<input>") return "input";
        if (word !== "<value>") return word;
        assert.ok(SAMPLE[flag], `add a sample value for --${flag}`);
        return SAMPLE[flag];
      });
    };
    const networks = words.includes("<network>") ? operation.networks : [null];
    const modes = words.includes("<mode>") ? Object.keys(operation.modes) : [null];
    const errors = [];
    const resolves = networks.some((network) =>
      modes.some((mode) => {
        try {
          resolveCommand(fill(network, mode));
          return true;
        } catch (error) {
          errors.push(error.message);
          return false;
        }
      }),
    );
    if (!resolves) stuck.push(`${row}: ${errors[0]}`);
  }
  assert.deepEqual(stuck, []);
});

test("contract operations group by verb, factor common options, and carry no retired names", () => {
  const projection = createProjections(REPO_ROOT).find((item) => item.output === "docs/docs/builders/packages/contract-operations.mdx");
  const rendered = renderProjection(REPO_ROOT, projection);
  const headings = [...rendered.matchAll(/^### (.+?) \(\d+\)$/gm)].map((match) => match[1]);
  assert.ok(headings.includes("Deploy") && headings.includes("Settlement"), headings.join(", "));
  assert.equal((rendered.match(/<CopyCommand command="bun run contracts -- /g) ?? []).length >= 92, true);
  assert.match(rendered, /^Options: `--save-artifacts`/m);
  assert.ok(rendered.includes('<CopyCommand command="bun run contracts -- deploy greenwill --network &lt;network&gt; --mode &lt;mode&gt;" />'), "network-scoped, mode-required commands carry both placeholders");
  assert.match(rendered, /<CopyCommand command="bun run contracts -- release operator[^"]*" \/>/, "an operation without a network stays listed");
  assert.doesNotMatch(rendered, /bun run contracts -- release operator[^"]*--network/, "an operation without a network carries no network placeholder");
  const deploySection = rendered.slice(rendered.indexOf("### Deploy ("), rendered.indexOf("### Upgrade ("));
  assert.ok((deploySection.match(/--first-support-metadata-uri/g) ?? []).length <= 2, "the deploy option list prints once per cluster");
  assert.doesNotMatch(rendered, /0x[a-fA-F0-9]{40}/);
  assert.equal(rendered.includes("Command migration"), false, "retired names stay out of the page");
  assert.equal(rendered.includes("| Previous manifest |"), false);
  assert.throws(() => assignOperationGroups([{ command: "teleport garden" }]), /Commands without a group: teleport garden/);
});

test("task routing labels every mutation boundary and places every core task in one group", () => {
  for (const token of Object.values(EXPECTED_MUTATION_BOUNDARIES)) assert.ok(mutationBoundaryLabel(token).length > 5);
  assert.throws(() => mutationBoundaryLabel("teleport-only"), /no reader-facing label/);
  const ids = Object.keys(EXPECTED_MUTATION_BOUNDARIES);
  assert.equal(assignTaskGroups(ids).size, ids.length);
  assert.throws(() => assignTaskGroups([...ids, "new-task"]), /Unassigned tasks: new-task/);
  const projection = createProjections(REPO_ROOT).find((item) => item.output === "docs/docs/builders/agentic/task-routing.mdx");
  const rendered = renderProjection(REPO_ROOT, projection);
  assert.match(rendered, /^## How an agent uses this$/m);
  assert.match(rendered, /^### Everyday work$/m);
  assert.ok(rendered.includes("Direct, bounded edits (`direct-bounded`)"));
  assert.ok(rendered.indexOf("## Core tasks") < rendered.indexOf("## Authority order"));
});


test("community glossary follows human concepts, rejects stale output, and cannot drop published terms", () => {
  const root = fixture();
  const projection = createProjections(REPO_ROOT).find(item => item.output === "docs/docs/reference/glossary.generated.mdx");
  try {
    for (const source of projection.sources) {
      const target = path.join(root, source);
      mkdirSync(path.dirname(target), {recursive: true});
      writeFileSync(target, readFileSync(path.join(REPO_ROOT, source)));
    }
    assert.deepEqual(syncProjections({root, projections: [projection], check: false}), []);
    const file = path.join(root, "packages/shared/src/ontology/green-goods-projections.json");
    const data = JSON.parse(readFileSync(file, "utf8"));
    data.human_concepts.find(concept => concept.ref === "entity:garden").example = "A new plain-language example.";
    writeFileSync(file, JSON.stringify(data));
    assert.ok(syncProjections({root, projections: [projection], check: true}).some(problem => problem.includes("stale:")));
    assert.ok(renderProjection(root, projection).includes("A new plain-language example."));
    assert.deepEqual(syncProjections({root, projections: [projection], check: false}), []);
    assert.deepEqual(syncProjections({root, projections: [projection], check: true}), []);
    const ontologyFile = path.join(root, "packages/shared/src/ontology/green-goods-ontology.json");
    const ontology = JSON.parse(readFileSync(ontologyFile, "utf8"));
    ontology.entities = ontology.entities.filter(term => term.id !== "attestation");
    writeFileSync(ontologyFile, JSON.stringify(ontology));
    assert.throws(() => renderProjection(root, projection), /Published glossary link attestation needs a declared replacement/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
