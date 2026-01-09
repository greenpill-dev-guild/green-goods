#!/usr/bin/env node
/**
 * Storacha upload script for CI/CD workflows.
 * Uses @storacha/client library which handles multibase-encoded proofs.
 *
 * Required env vars:
 *   VITE_STORACHA_KEY   - Base64-encoded ed25519 private key
 *   VITE_STORACHA_PROOF - Multibase-encoded delegation proof
 *
 * Usage: node scripts/storacha-upload.js <path-to-upload>
 * Output: Prints CID to stdout on success
 */

import { create } from '@storacha/client';
import { Signer } from '@storacha/client/principal/ed25519';
import { parse as parseProof } from '@storacha/client/proof';
import { filesFromPaths } from 'files-from-path';

const key = process.env.VITE_STORACHA_KEY;
const proof = process.env.VITE_STORACHA_PROOF;
const uploadPath = process.argv[2];

if (!key || !proof) {
  console.error('Missing VITE_STORACHA_KEY or VITE_STORACHA_PROOF environment variables');
  process.exit(1);
}

if (!uploadPath) {
  console.error('Usage: storacha-upload.js <path-to-upload>');
  process.exit(1);
}

try {
  // Parse principal and create client with ephemeral store
  const principal = Signer.parse(key);
  const memoryStore = {
    data: null,
    async load() { return this.data; },
    async save(data) { this.data = data; },
    async reset() { this.data = null; },
  };
  const client = await create({ principal, store: memoryStore });

  // Parse proof (handles multibase internally) and add space
  const delegation = await parseProof(proof);
  const space = await client.addSpace(delegation);
  await client.setCurrentSpace(space.did());

  // Upload directory
  const files = await filesFromPaths([uploadPath]);
  const cid = await client.uploadDirectory(files);

  // Output just the CID for easy capture in shell
  console.log(cid.toString());
} catch (error) {
  console.error('Upload failed:', error.message);
  process.exit(1);
}
