#!/usr/bin/env bun

// Clean-room route proof is legitimate evidence when it is labeled as such. This step
// prints the label reminder before `bun run browser routes` builds and proves the public
// routes; it never blocks. AGENTS.md § Browser Evidence names the surfaces that still need
// the authenticated Brave profile instead.
console.warn(
  [
    '[browser-evidence] Clean-room route proof: label it as non-authenticated evidence in reports and PR bodies.',
    '[browser-evidence] Wallet, passkey, session, installed-PWA, service-worker, job-queue, and profile-identity surfaces still need authenticated Brave proof (AGENTS.md § Browser Evidence).',
  ].join('\n'),
);
process.exit(0);
