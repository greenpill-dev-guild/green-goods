#!/usr/bin/env node

/**
 * Pinata IPFS Deploy
 *
 * Uploads a built dist directory to Pinata via the pinFileToIPFS API and
 * prints the resulting root CID to stdout. Used by .github/workflows/deploy-ipfs.yml
 * after we migrated off storacha.
 *
 * Required env:
 *   PINATA_JWT     - Pinata service JWT (sk_*)
 * Optional env:
 *   PINATA_NAME    - human-readable name attached to the pin (e.g. "client-<sha>")
 *   PINATA_API     - override the API base URL (default: https://api.pinata.cloud)
 *
 * Usage:
 *   node scripts/pinata-deploy.js <dist-dir> [pinName]
 */

import fs from "node:fs";
import path from "node:path";

const PINATA_API = process.env.PINATA_API || "https://api.pinata.cloud";
const PIN_FILE_ENDPOINT = `${PINATA_API}/pinning/pinFileToIPFS`;

function fail(message, code = 1) {
  console.error(`[pinata-deploy] ${message}`);
  process.exit(code);
}

const distDir = process.argv[2];
const pinNameArg = process.argv[3];

if (!distDir) fail("missing required argument <dist-dir>");
if (!fs.existsSync(distDir)) fail(`dist directory does not exist: ${distDir}`);
if (!fs.statSync(distDir).isDirectory()) fail(`not a directory: ${distDir}`);

const jwt = process.env.PINATA_JWT;
if (!jwt) fail("PINATA_JWT env var is required");

const pinName = pinNameArg || process.env.PINATA_NAME || `green-goods-${Date.now()}`;

function walk(dir, base = dir) {
  const entries = [];
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      entries.push(...walk(abs, base));
    } else if (stat.isFile()) {
      entries.push({ abs, rel: path.relative(base, abs) });
    }
  }
  return entries;
}

async function upload() {
  const files = walk(distDir);
  if (files.length === 0) fail(`no files found in ${distDir}`);

  const rootName = path.basename(path.resolve(distDir));
  const form = new FormData();

  for (const { abs, rel } of files) {
    const buffer = fs.readFileSync(abs);
    const blob = new Blob([buffer]);
    // Pinata wraps the upload in a directory whose name comes from the first
    // filepath segment. Prefix with the root dir so the resulting CID points
    // to the directory, not a flat file.
    const filepath = `${rootName}/${rel.split(path.sep).join("/")}`;
    form.append("file", blob, filepath);
  }

  form.append("pinataMetadata", JSON.stringify({ name: pinName }));
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1, wrapWithDirectory: false }));

  const response = await fetch(PIN_FILE_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });

  const text = await response.text();
  if (!response.ok) {
    fail(`Pinata upload failed (${response.status}): ${text}`);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    fail(`Pinata returned non-JSON response: ${text}`);
  }

  const cid = payload?.IpfsHash;
  if (!cid) fail(`Pinata response missing IpfsHash: ${text}`);

  console.error(`[pinata-deploy] uploaded ${files.length} files as ${pinName} -> ${cid}`);
  process.stdout.write(cid);
}

upload().catch((err) => fail(err?.message || String(err)));
