import assert from "node:assert/strict";
import test from "node:test";

import {
  extractExportedHookNames,
  extractInternalPackageImports,
  findDirectedCycles,
  findPackageArchitectureViolations,
  findSharedExportTargetViolations,
  parseJsxAttributes,
  scanRule19Source,
  stripJsComments,
} from "./check-react-patterns.js";

const rule19Lines = (source) =>
  scanRule19Source("packages/client/src/Example.tsx", source).map((hit) => hit.line);

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
