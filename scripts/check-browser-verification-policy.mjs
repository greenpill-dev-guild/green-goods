#!/usr/bin/env bun

// Browser evidence has one canonical home: AGENTS.md § Browser Evidence. This check keeps
// that section present with its three rules, makes the other agent entry points point at it
// instead of restating it, and keeps the "stop and report QA as blocked" dead end from
// returning. It deliberately does not police wording beyond that.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const canonicalFile = 'AGENTS.md';
const canonicalMarkers = [
  { pattern: /^### Browser Evidence\s*$/m, label: 'the "### Browser Evidence" section' },
  { pattern: /label every rendered proof/i, label: 'the evidence-label rule' },
  { pattern: /authenticated surface class/i, label: 'the authenticated surface class rule' },
  { pattern: /advisory/i, label: 'the advisory local-check rule' },
  { pattern: /--attest browser-proof/, label: 'the release attestation command' },
];
const pointerFiles = [
  'CLAUDE.md',
  'ONBOARDING.md',
  'packages/admin/AGENTS.md',
  'packages/client/AGENTS.md',
  'packages/shared/AGENTS.md',
];
const pointerPattern = /AGENTS\.md(#browser-evidence| § Browser Evidence)/;
const deadEndPatterns = [
  /stop and report QA as blocked/i,
  /report QA as blocked rather than/i,
];

const failures = [];
const read = (relPath) => readFileSync(join(repoRoot, relPath), 'utf8');

if (!existsSync(join(repoRoot, canonicalFile))) {
  failures.push(`${canonicalFile}: missing`);
} else {
  const text = read(canonicalFile);
  for (const { pattern, label } of canonicalMarkers) {
    if (!pattern.test(text)) failures.push(`${canonicalFile}: missing ${label}`);
  }
}

for (const relPath of pointerFiles) {
  if (!existsSync(join(repoRoot, relPath))) {
    failures.push(`${relPath}: missing browser-evidence pointer file`);
    continue;
  }
  if (!pointerPattern.test(read(relPath))) {
    failures.push(`${relPath}: must point at AGENTS.md § Browser Evidence instead of restating it`);
  }
}

for (const relPath of [canonicalFile, ...pointerFiles]) {
  if (!existsSync(join(repoRoot, relPath))) continue;
  const text = read(relPath);
  for (const pattern of deadEndPatterns) {
    if (pattern.test(text)) failures.push(`${relPath}: reintroduces the "report QA as blocked" dead end (${pattern})`);
  }
}

if (failures.length > 0) {
  console.error('Browser evidence policy check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Browser evidence policy check passed: ${canonicalFile} § Browser Evidence plus ${pointerFiles.length} pointer file(s).`,
);
