import assert from "node:assert/strict";
import test from "node:test";

import {
  compareRatchet,
  countRatchetHits,
  extractExportedHookNames,
  extractInternalPackageImports,
  findDirectedCycles,
  findPackageArchitectureViolations,
  findRatchetBaselineGrowth,
  findSharedExportTargetViolations,
  isReactModule,
  parseJsxAttributes,
  parseRatchetBaseline,
  ratchetFailures,
  scanRule14Source,
  scanRule19Source,
  shrinkRatchet,
  stripJsComments,
} from "./check-react-patterns.js";

const rule19Lines = (source) =>
  scanRule19Source("packages/client/src/Example.tsx", source).map((hit) => hit.line);

test("rule 14 flags whole reads of import.meta.env and allows reads by key", () => {
  const source = [
    "const isDev = import.meta.env.DEV;",
    'const isTest = import.meta.env?.MODE === "test";',
    "export function load(env: Env = import.meta.env) {}",
    "const keys = Object.keys(import.meta.env);",
    "const value = import.meta.env[key];",
    "const { PROD } = import.meta.env;",
    "// const env = import.meta.env;",
    "const indexerUrl = import.meta.env",
    "  .VITE_ENVIO_INDEXER_URL;",
    'const env = typeof import.meta !== "undefined" ? { DEV: import.meta.env.DEV } : {};',
  ].join("\n");

  const hits = scanRule14Source("packages/shared/src/example.ts", source);

  assert.deepEqual(
    hits.map((hit) => hit.line),
    [3, 4, 5, 6],
  );
  assert.equal(hits[0].rule, "rule-14-whole-env-read");
  assert.equal(hits[0].snippet, "export function load(env: Env = import.meta.env) {}");
});

test("detects forbidden package direction and package-level cycles", () => {
  const records = [
    {
      directory: "contracts",
      manifest: {
        name: "@green-goods/contracts",
        dependencies: { "@green-goods/shared": "workspace:*" },
      },
      sourceImports: [],
    },
    {
      directory: "shared",
      manifest: {
        name: "@green-goods/shared",
        dependencies: { "@green-goods/contracts": "workspace:*" },
      },
      sourceImports: [],
    },
  ];

  const rules = findPackageArchitectureViolations(records).map((hit) => hit.rule);
  assert.ok(rules.includes("architecture-package-direction"));
  assert.ok(rules.includes("architecture-package-cycle"));
});

test("detects allowed source imports missing from production dependencies", () => {
  const records = [
    {
      directory: "shared",
      manifest: { name: "@green-goods/shared" },
      sourceImports: [],
    },
    {
      directory: "client",
      manifest: { name: "@green-goods/client" },
      sourceImports: [
        {
          file: "packages/client/src/example.ts",
          line: 1,
          importPath: "@green-goods/shared",
          target: "shared",
        },
      ],
    },
  ];

  const hits = findPackageArchitectureViolations(records);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].rule, "architecture-undeclared-package-import");
});

test("extracts static and dynamic internal-package imports", () => {
  assert.deepEqual(
    extractInternalPackageImports(
      'import { logger } from "@green-goods/shared";\nconst lazy = import(\n  "@green-goods/shared/utils"\n);',
    ),
    [
      { importPath: "@green-goods/shared", target: "shared", line: 1 },
      { importPath: "@green-goods/shared/utils", target: "shared", line: 2 },
    ],
  );
});

test("detects missing and external shared export targets", () => {
  const hits = findSharedExportTargetViolations(
    {
      "./missing": "./src/missing.ts",
      "./external": "../outside.ts",
    },
    { packageRoot: "/virtual/shared", fileExists: () => false },
  );

  assert.equal(hits.length, 2);
  assert.ok(hits.every((hit) => hit.rule === "architecture-shared-export-target"));
});

test("detects exported consumer hooks without treating private hooks as package APIs", () => {
  const source = [
    "function usePrivateState() {}",
    "// export function useCommentedOutState() {}",
    "export function usePublicState() {}",
    "export const usePublicValue = () => null;",
  ].join("\n");

  assert.deepEqual(extractExportedHookNames(source), [
    { name: "usePublicState", line: 3 },
    { name: "usePublicValue", line: 4 },
  ]);
});

test("cycle detection names the complete package cycle", () => {
  assert.deepEqual(findDirectedCycles({ contracts: ["shared"], shared: ["contracts"] }), [
    ["contracts", "shared", "contracts"],
  ]);
});

test("rule 19 flags a raw button unless it declares a known role or pressable kind", () => {
  const source = [
    '<button type="button" onClick={retry}>Retry</button>',
    '<button type="button" data-pressable="card" onClick={() => open(id)}>Card</button>',
    '<button type="button" role="tab" aria-selected={active}>Tab</button>',
    '<button type="button" data-pressable="pill">Unknown kind</button>',
    '<button type="button" role={role}>Dynamic role</button>',
    '<button type="button" role="menuitem">Menu item</button>',
  ].join("\n");

  const hits = scanRule19Source("packages/client/src/Example.tsx", source);
  assert.deepEqual(
    hits.map((hit) => hit.line),
    [1, 4, 5, 6],
  );
  assert.ok(hits.every((hit) => hit.rule === "rule-19-client-shared-controls"));
  assert.ok(hits.every((hit) => hit.file === "packages/client/src/Example.tsx"));
});

test("rule 19 reads a multi-line tag past arrow functions, spreads, and strings holding >", () => {
  const source = [
    "<button",
    '  type="button"',
    "  {...rest}",
    "  onClick={() => {",
    '    if (a > b) setLabel({ text: "=>" });',
    "  }}",
    '  data-pressable="row"',
    ">",
    "  Row",
    "</button>",
    "<button",
    '  type="button"',
    "  onClick={() => (open ? close() : setOpen(true))}",
    ">",
  ].join("\n");

  assert.deepEqual(rule19Lines(source), [11]);
  const attrs = parseJsxAttributes(
    '<button type="button" onClick={() => x > 1} data-pressable="media" />',
    "<button".length,
  );
  assert.equal(attrs.get("data-pressable"), "media");
});

test("rule 19 allows raw inputs only for native choice, file, hidden, and range types", () => {
  const source = [
    '<input type="file" hidden onChange={onPick} />',
    '<input type="checkbox" checked={on} onChange={toggle} />',
    '<input type="radio" name="unit" />',
    "<input value={name} onChange={onChange} />",
    '<input type="email" value={email} />',
    "<textarea value={note} />",
    "<select value={unit} onChange={onUnit}>",
  ].join("\n");

  const hits = scanRule19Source("packages/client/src/Example.tsx", source);
  assert.deepEqual(
    hits.map((hit) => hit.line),
    [4, 5, 6, 7],
  );
  assert.match(hits[0].snippet, /raw <input type="text">/);
  assert.match(hits[2].snippet, /use Textarea/);
  assert.match(hits[3].snippet, /use NativeSelect/);
});

test("rule 19 flags a link dressed as a button, not a plain or transparent link", () => {
  const source = [
    '<Link to="/gardens" className="rounded-full bg-primary-action px-5 py-3">Explore</Link>',
    '<a href={url} className={cn("inline-flex rounded-full border px-4", w && "w-full")}>Get</a>',
    '<a href={url} className="underline decoration-dotted">Source</a>',
    '<Link to="/" className="rounded-full bg-transparent">Home</Link>',
  ].join("\n");

  assert.deepEqual(rule19Lines(source), [1, 2]);
});

test("rule 19 keeps shape, height, and vertical padding classes off the shared family", () => {
  const source = [
    '<Button emphasis="secondary" className="w-full">Retry</Button>',
    '<Button className="rounded-lg">Square</Button>',
    '<IconButton aria-label="Close" icon={<RiCloseLine />} className="md:h-12" />',
    '<Chip selected className={cn("shrink-0", dense && "py-1")}>Filter</Chip>',
    "<Button {...rest} className={`size-10 ${extra}`} />",
    '<Button asChild className="-ml-3 min-w-0"><Link to="/">Home</Link></Button>',
  ].join("\n");

  const hits = scanRule19Source("packages/client/src/Example.tsx", source);
  assert.deepEqual(
    hits.map((hit) => hit.line),
    [2, 3, 4, 5],
  );
  assert.match(hits[1].snippet, /"md:h-12" on <IconButton>/);
});

test("rule 19 flags off-scale radii and ignores commented-out code and URLs", () => {
  const source = [
    '<div className="rounded-3xl border" />',
    'const panel = cn("md:rounded-t-sm", open && "rounded-2xl");',
    '// <button className="rounded-4xl">Old</button>',
    "/* <textarea />",
    "   <select /> */",
    '<a href="https://example.com/rounded-3xl">Link</a>',
    '<div className="rounded-lg sm:rounded-xl rounded-full" />',
  ].join("\n");

  assert.deepEqual(rule19Lines(source), [1, 2]);
  const stripped = stripJsComments(source);
  assert.equal(stripped.length, source.length);
  assert.equal(stripped.split("\n").length, source.split("\n").length);
  // The `//` inside the link's address is not a comment, so its line survives unchanged.
  assert.equal(stripped.split("\n")[5], source.split("\n")[5]);
});

test("rule 19 flags every import of the retired client Button", () => {
  const source = [
    'import { Button } from "@/components/Actions";',
    'import { Button as Legacy } from "../../components/Actions/Button";',
    'import { WalletConnectButton } from "@/components/Actions/WalletConnectButton";',
    'import { Button } from "@green-goods/shared/components/Button";',
  ].join("\n");

  assert.deepEqual(rule19Lines(source), [1, 2]);
});

test("rule 19 ignores TypeScript generics that share a tag name", () => {
  const source = [
    "const ref = useRef<Button | null>(null);",
    "type Links = Array<Link>;",
    "const size = count <input.length ? 1 : 0;",
  ].join("\n");

  assert.deepEqual(rule19Lines(source), []);
});

test("the debt ratchet fails a new or grown count and asks for a shrink when one falls", () => {
  const timer = (file) => ({ rule: "rule-1-raw-timer", file, line: 1, snippet: "setTimeout(" });
  const baseline = { "rule-1-raw-timer": { "a.ts": 2, "b.ts": 1 } };
  const counts = countRatchetHits([
    timer("a.ts"),
    timer("a.ts"),
    timer("a.ts"),
    timer("c.ts"),
    { rule: "rule-6-zustand-whole-state", file: "a.ts" },
  ]);
  assert.deepEqual(counts, { "rule-1-raw-timer": { "a.ts": 3, "c.ts": 1 } });
  assert.deepEqual(compareRatchet(baseline, counts), {
    grown: [
      { rule: "rule-1-raw-timer", file: "a.ts", was: 2, now: 3 },
      { rule: "rule-1-raw-timer", file: "c.ts", was: 0, now: 1 },
    ],
    stale: [{ rule: "rule-1-raw-timer", file: "b.ts", was: 1, now: 0 }],
  });
  assert.throws(() => shrinkRatchet(baseline, counts), /refusing to shrink/);
  assert.deepEqual(shrinkRatchet(baseline, { "rule-1-raw-timer": { "a.ts": 1 } }), {
    "rule-1-raw-timer": { "a.ts": 1 },
  });
});

test("the ratchet baseline may not grow over the base branch's copy", () => {
  const base = { "rule-5-address-as-string": { "a.ts": 2 } };
  assert.deepEqual(findRatchetBaselineGrowth({ "rule-5-address-as-string": { "a.ts": 1 } }, base), []);
  assert.deepEqual(
    findRatchetBaselineGrowth({ "rule-5-address-as-string": { "a.ts": 2, "b.ts": 1 } }, base),
    [{ rule: "rule-5-address-as-string", file: "b.ts", was: 0, now: 1 }],
  );
  assert.deepEqual(findRatchetBaselineGrowth({ "rule-5-address-as-string": { "a.ts": 3 } }, base), [
    { rule: "rule-5-address-as-string", file: "a.ts", was: 2, now: 3 },
  ]);
  assert.deepEqual(findRatchetBaselineGrowth({ "rule-5-address-as-string": { "a.ts": 9 } }, null), []);
  assert.equal(parseRatchetBaseline(JSON.stringify({ note: "an old advisory inventory", rules: {} })), null);
});

test("a renamed file keeps its allowance, and the baseline key may move with it", () => {
  const baseline = { "rule-1-raw-timer": { "old.ts": 2 } };
  const renames = new Map([["new.ts", "old.ts"]]);
  const counts = { "rule-1-raw-timer": { "new.ts": 2 } };
  assert.deepEqual(compareRatchet(baseline, counts, renames), { grown: [], stale: [] });
  assert.deepEqual(shrinkRatchet(baseline, { "rule-1-raw-timer": { "new.ts": 1 } }, renames), {
    "rule-1-raw-timer": { "new.ts": 1 },
  });
  assert.deepEqual(findRatchetBaselineGrowth({ "rule-1-raw-timer": { "new.ts": 2 } }, baseline, renames), []);
  assert.equal(compareRatchet(baseline, { "rule-1-raw-timer": { "new.ts": 3 } }, renames).grown.length, 1);
});

test("a ratchet baseline with anything but positive whole counts for known rules is refused", () => {
  const baseline = (counts) => JSON.stringify({ version: 1, counts });
  for (const count of ["any", {}, 0, -1, 1.5, null]) {
    assert.throws(() => parseRatchetBaseline(baseline({ "rule-1-raw-timer": { "a.ts": count } })), /positive whole number/);
  }
  assert.throws(() => parseRatchetBaseline(baseline({ "rule-6-zustand-whole-state": { "a.ts": 1 } })), /unknown rule/);
  assert.deepEqual(parseRatchetBaseline(baseline({ "rule-1-raw-timer": { "a.ts": 2 } })), { "rule-1-raw-timer": { "a.ts": 2 } });
});

test("a stale count fails where the change touches it, and everywhere when the base is unknown", () => {
  const baseline = { "rule-1-raw-timer": { "touched.ts": 2, "elsewhere.ts": 1 } };
  const hits = [{ rule: "rule-1-raw-timer", file: "touched.ts", line: 4 }];
  const context = { base: "origin/develop", previous: baseline, changed: new Set(["touched.ts"]), renames: new Map() };
  const known = ratchetFailures({ hits, baseline, context });
  assert.equal(known.failures.length, 2);
  assert.match(known.failures[1], /touched\.ts: 2 -> 1/);
  assert.ok(known.notes.some((note) => /1 count\(s\) fell below the baseline in files this change does not touch/.test(note)));
  const unknown = ratchetFailures({ hits, baseline, context: { base: null, previous: null, changed: null, renames: new Map() } });
  assert.equal(unknown.failures.length, 3);
  assert.ok(unknown.notes.some((note) => /checked against the tree only/.test(note)));
  const grown = ratchetFailures({ hits: [...hits, ...hits, ...hits], baseline, context });
  assert.match(grown.failures[0], /touched\.ts: 3 hit\(s\) \(lines 4, 4, 4\), baseline allows 2/);
});

test("the timer rule reads React modules only, where its hook wrappers apply", () => {
  assert.equal(isReactModule('import { useEffect } from "react";\nsetTimeout(run, 10);'), true);
  assert.equal(isReactModule("export function useCountdown() {\n  return setInterval(tick, 1000);\n}"), true);
  assert.equal(isReactModule("export function withDeadline(task) {\n  const timer = setTimeout(abort, 10);\n  return task.finally(() => clearTimeout(timer));\n}"), false);
});
