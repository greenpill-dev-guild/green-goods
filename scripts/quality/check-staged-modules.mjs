#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const STAGED_MODULES = [
  "packages/client/src/components/Public/VaultCardEndowFlow.tsx",
  "packages/client/src/components/Public/VaultCardPaymentPanel.tsx",
  "packages/client/src/components/Public/VaultCardWalletManage.calls.ts",
  "packages/client/src/components/Public/VaultCardWalletManage.tsx",
];

const STAGED_MARKER = "Staged — not yet wired into the live checkout.";
const SOURCE_EXTENSIONS = [".ts", ".tsx"];

function sourceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension)) ? [path] : [];
  });
}

function resolveImport(root, importer, specifier) {
  const base = specifier.startsWith("@/")
    ? resolve(root, "packages/client/src", specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(importer), specifier)
      : null;
  if (!base) return null;
  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => resolve(base, `index${extension}`)),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function importSpecifiers(source) {
  const matches = source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["']([^"']+)["']/g);
  return [...matches].map((match) => match[1]);
}

export function auditStagedModules(root) {
  const findings = [];
  const stagedAbsolute = new Set(STAGED_MODULES.map((path) => resolve(root, path)));

  for (const path of STAGED_MODULES) {
    const absolute = resolve(root, path);
    if (!existsSync(absolute)) {
      findings.push(`${path}: staged module is missing`);
      continue;
    }
    if (!readFileSync(absolute, "utf8").includes(STAGED_MARKER)) {
      findings.push(`${path}: missing staged marker`);
    }
  }

  for (const importer of sourceFiles(resolve(root, "packages/client/src"))) {
    if (stagedAbsolute.has(importer)) continue;
    for (const specifier of importSpecifiers(readFileSync(importer, "utf8"))) {
      const imported = resolveImport(root, importer, specifier);
      if (!imported || !stagedAbsolute.has(imported)) continue;
      findings.push(
        `${relative(root, importer)} imports staged module ${relative(root, imported)}`
      );
    }
  }

  return findings.sort();
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const findings = auditStagedModules(projectRoot);
  if (findings.length > 0) {
    console.error(`check-staged-modules: ${findings.length} violation(s)`);
    for (const finding of findings) console.error(`- ${finding}`);
    process.exitCode = 1;
  } else {
    console.log(`check-staged-modules: ${STAGED_MODULES.length} staged modules remain isolated.`);
  }
}
