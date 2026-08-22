import assert from "node:assert/strict";
import test from "node:test";

import {
  extractExportedHookNames,
  extractInternalPackageImports,
  findDirectedCycles,
  findPackageArchitectureViolations,
  findSharedExportTargetViolations,
} from "./check-react-patterns.js";

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
