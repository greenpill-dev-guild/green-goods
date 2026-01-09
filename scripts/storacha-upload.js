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

// Trim whitespace/newlines that might be added by secret managers
const key = (process.env.VITE_STORACHA_KEY || '').trim();
const proof = (process.env.VITE_STORACHA_PROOF || '').trim();
const uploadPath = process.argv[2];

if (!key || !proof) {
  console.error('Missing VITE_STORACHA_KEY or VITE_STORACHA_PROOF environment variables');
  process.exit(1);
}

if (!uploadPath) {
  console.error('Usage: storacha-upload.js <path-to-upload>');
  process.exit(1);
}

// Debug: show credential format (not the actual values)
const debugMode = process.env.DEBUG === 'true';
if (debugMode) {
  console.error(`Key length: ${key.length}, starts with: ${key.substring(0, 10)}...`);
  console.error(`Key ends with: ...${key.substring(key.length - 10)}`);
  console.error(`Proof length: ${proof.length}, starts with: ${proof.substring(0, 10)}...`);

  // Check for common issues
  if (key.includes('\n')) console.error('⚠️  Key contains newlines');
  if (key.includes(' ')) console.error('⚠️  Key contains spaces');
  if (proof.includes('\n')) console.error('⚠️  Proof contains newlines');
  if (proof.includes(' ')) console.error('⚠️  Proof contains spaces');

  // Check expected formats
  // Key should be a base64url-nopad ed25519 key (starts with MgCY or similar)
  // Proof should be multibase base64pad (starts with 'm')
  if (!proof.startsWith('m')) {
    console.error(`⚠️  Proof doesn't start with 'm' (multibase base64pad prefix). Got: '${proof.charAt(0)}'`);
  }
}

try {
  // Parse principal and create client with ephemeral store
  const principal = Signer.parse(key);
  if (debugMode) console.error('✓ Key parsed successfully');
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
  if (debugMode) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}
