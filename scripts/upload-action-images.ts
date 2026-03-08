#!/usr/bin/env bun

/**
 * Action Image Uploader
 *
 * Compresses action card images to WebP format, uploads to Storacha (IPFS/Filecoin),
 * and updates actions.json with the resulting CIDs.
 *
 * Pipeline: PNG (1536x1024, ~3.4MB) → WebP (800x533, ~40KB) → Storacha → actions.json
 *
 * Usage:
 *   bun scripts/upload-action-images.ts              # Full run
 *   bun scripts/upload-action-images.ts --dry-run    # Compress only, no upload
 *   bun scripts/upload-action-images.ts --force      # Skip cache, re-upload all
 *
 * Required env vars (unless --dry-run):
 *   VITE_STORACHA_KEY   - Base64-encoded ed25519 private key
 *   VITE_STORACHA_PROOF - Multibase-encoded delegation proof
 */

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import sharp from "sharp";

// --- Paths ---

const ROOT_DIR = path.join(import.meta.dir, "..");
const CONTRACTS_DIR = path.join(ROOT_DIR, "packages", "contracts");
const IMAGES_DIR = path.join(CONTRACTS_DIR, "config", "action-images");
const ACTIONS_FILE = path.join(CONTRACTS_DIR, "config", "actions.json");
const CACHE_FILE = path.join(CONTRACTS_DIR, ".action-images-cache.json");
const TEMP_DIR = path.join(os.tmpdir(), "green-goods-action-images-webp");

// --- Compression targets (from action-image-prompts.md) ---

const TARGET_WIDTH = 800;
const TARGET_HEIGHT = 533;
const WEBP_QUALITY = 80;

// --- Filename overrides for mismatches between slug and actual filename ---
// The canonical slug is in actions.json; the filename on disk may differ.

const FILENAME_OVERRIDES: Record<string, string> = {
	// Add slug → filename overrides here when filenames don't match the slug pattern.
	// Example: "agro.planting_event": "agro-planting-event-v2"
};

// --- Types ---

interface ActionEntry {
	slug: string;
	domain: string;
	title: string;
	description: string;
	capitals: string[];
	startTime: string;
	endTime: string;
	media: string[];
	uiConfig: Record<string, unknown>;
	[key: string]: unknown;
}

interface ActionsData {
	domainConfig: Record<string, unknown>;
	templates: Record<string, unknown>;
	actions: ActionEntry[];
}

interface CacheEntry {
	contentHash: string;
	cid: string;
	slug: string;
	uploadedAt: string;
}

type Cache = Record<string, CacheEntry>;

interface CompressedImage {
	slug: string;
	title: string;
	webpPath: string;
	contentHash: string;
	originalSize: number;
	compressedSize: number;
}

// --- Environment loading (same pattern as ipfs-uploader.ts) ---

function loadEnvFile(envPath: string): void {
	try {
		if (!fs.existsSync(envPath)) return;
		const content = fs.readFileSync(envPath, "utf8");
		for (const line of content.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const eqIndex = trimmed.indexOf("=");
			if (eqIndex === -1) continue;
			const key = trimmed.slice(0, eqIndex).trim();
			let value = trimmed.slice(eqIndex + 1).trim();
			if (value.startsWith('"')) {
				const close = value.indexOf('"', 1);
				if (close !== -1) value = value.slice(1, close);
			} else if (value.startsWith("'")) {
				const close = value.indexOf("'", 1);
				if (close !== -1) value = value.slice(1, close);
			} else {
				const commentIdx = value.indexOf("#");
				if (commentIdx !== -1) value = value.slice(0, commentIdx).trim();
			}
			if (process.env[key] === undefined) {
				process.env[key] = value;
			}
		}
	} catch {
		// Silently fail — env vars may already be set via CI
	}
}

// --- Helpers ---

function slugToFilename(slug: string): string {
	if (FILENAME_OVERRIDES[slug]) return FILENAME_OVERRIDES[slug];
	return slug.replace(/\./g, "-").replace(/_/g, "-");
}

function hashFile(filePath: string): string {
	const content = fs.readFileSync(filePath);
	return createHash("sha256").update(content).digest("hex");
}

function loadCache(): Cache {
	try {
		if (fs.existsSync(CACHE_FILE)) {
			return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
		}
	} catch {
		console.error("Warning: Unable to load cache, starting fresh.");
	}
	return {};
}

function saveCache(cache: Cache): void {
	try {
		fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2) + "\n");
	} catch (error) {
		console.error("Warning: Unable to save cache.", error);
	}
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// --- Storacha client (ephemeral principal pattern from storacha-upload.js) ---

interface StorachaClient {
	uploadFile: (file: File) => Promise<{ toString(): string }>;
	setCurrentSpace: (did: string) => Promise<void>;
	addSpace: (proof: unknown) => Promise<{ did(): string }>;
}

async function initStoracha(): Promise<StorachaClient> {
	const storachaKey = (process.env.VITE_STORACHA_KEY || "").trim();
	const storachaProof = (process.env.VITE_STORACHA_PROOF || "").trim();

	if (!storachaKey || !storachaProof) {
		throw new Error(
			"VITE_STORACHA_KEY and VITE_STORACHA_PROOF environment variables required",
		);
	}

	const { create } = await import("@storacha/client");
	const { Signer } = await import("@storacha/client/principal/ed25519");
	const { parse: parseProof } = await import("@storacha/client/proof");

	// Use explicit principal + ephemeral memory store (matches storacha-upload.js)
	const principal = Signer.parse(storachaKey);
	const memoryStore = {
		data: null as Uint8Array | null,
		async load() {
			return this.data;
		},
		async save(data: Uint8Array) {
			this.data = data;
		},
		async reset() {
			this.data = null;
		},
	};
	const client = await create({ principal, store: memoryStore });

	const delegation = await parseProof(storachaProof);
	const space = await client.addSpace(delegation);
	await client.setCurrentSpace(space.did());

	return client as unknown as StorachaClient;
}

async function uploadToStoracha(
	client: StorachaClient,
	filePath: string,
	fileName: string,
	retries = 3,
): Promise<string> {
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			const buffer = fs.readFileSync(filePath);
			const blob = new Blob([buffer], { type: "image/webp" });
			const file = new File([blob], fileName, { type: "image/webp" });
			const cid = await client.uploadFile(file);
			return cid.toString();
		} catch (error) {
			if (attempt === retries) throw error;
			const delay = 1000 * attempt;
			console.error(`    Retry ${attempt}/${retries} in ${delay}ms...`);
			await new Promise((r) => setTimeout(r, delay));
		}
	}
	throw new Error("Upload failed after all retries");
}

// --- Pipeline stages ---

async function compressImages(
	actions: ActionEntry[],
): Promise<CompressedImage[]> {
	console.error("--- Stage 1: Compress ---\n");

	fs.mkdirSync(TEMP_DIR, { recursive: true });
	const results: CompressedImage[] = [];
	let totalOriginal = 0;
	let totalCompressed = 0;
	let missing = 0;

	for (const action of actions) {
		const baseName = slugToFilename(action.slug);
		const pngPath = path.join(IMAGES_DIR, `${baseName}.png`);

		if (!fs.existsSync(pngPath)) {
			console.error(`  SKIP: ${baseName}.png not found (slug: ${action.slug})`);
			missing++;
			continue;
		}

		const webpName = `${baseName}.webp`;
		const webpPath = path.join(TEMP_DIR, webpName);

		await sharp(pngPath)
			.resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "cover" })
			.webp({ quality: WEBP_QUALITY })
			.toFile(webpPath);

		const originalSize = fs.statSync(pngPath).size;
		const compressedSize = fs.statSync(webpPath).size;
		const contentHash = hashFile(webpPath);
		const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);

		totalOriginal += originalSize;
		totalCompressed += compressedSize;

		results.push({
			slug: action.slug,
			title: action.title,
			webpPath,
			contentHash,
			originalSize,
			compressedSize,
		});

		console.error(
			`  ${webpName} — ${formatSize(originalSize)} -> ${formatSize(compressedSize)} (${reduction}% smaller)`,
		);
	}

	console.error(
		`\n  Total: ${formatSize(totalOriginal)} -> ${formatSize(totalCompressed)} (${results.length} images, ${missing} missing)\n`,
	);

	return results;
}

async function uploadImages(
	compressed: CompressedImage[],
	cache: Cache,
): Promise<Record<string, string>> {
	console.error("--- Stage 2: Upload to Storacha ---\n");

	const client = await initStoracha();
	const cidMap: Record<string, string> = {};
	let uploads = 0;
	let cacheHits = 0;

	for (const item of compressed) {
		const cached = cache[item.slug];

		if (cached && cached.contentHash === item.contentHash) {
			cacheHits++;
			cidMap[item.slug] = cached.cid;
			console.error(
				`  CACHED: ${item.slug} -> ${cached.cid.slice(0, 24)}...`,
			);
			continue;
		}

		try {
			const fileName = path.basename(item.webpPath);
			const cid = await uploadToStoracha(client, item.webpPath, fileName);
			uploads++;
			cidMap[item.slug] = cid;

			cache[item.slug] = {
				contentHash: item.contentHash,
				cid,
				slug: item.slug,
				uploadedAt: new Date().toISOString(),
			};

			console.error(`  UPLOAD: ${item.slug} -> ${cid.slice(0, 24)}...`);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			console.error(`  FAIL:  ${item.slug} — ${msg}`);

			if (cached?.cid) {
				console.error("         Using cached CID as fallback");
				cidMap[item.slug] = cached.cid;
			} else {
				console.error("         No cache fallback — aborting");
				process.exit(1);
			}
		}
	}

	console.error(`\n  ${uploads} uploaded, ${cacheHits} cached\n`);
	return cidMap;
}

function updateActionsJson(
	actionsData: ActionsData,
	cidMap: Record<string, string>,
): number {
	console.error("--- Stage 3: Update actions.json ---\n");

	let updated = 0;

	for (const action of actionsData.actions) {
		const cid = cidMap[action.slug];
		if (!cid) continue;

		const ipfsUri = `ipfs://${cid}`;
		if (action.media.length === 0 || !action.media.includes(ipfsUri)) {
			action.media = [ipfsUri];
			updated++;
		}
	}

	fs.writeFileSync(ACTIONS_FILE, JSON.stringify(actionsData, null, 2) + "\n");
	console.error(`  ${updated} actions updated with IPFS URIs\n`);
	return updated;
}

// --- Main ---

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const dryRun = args.includes("--dry-run");
	const force = args.includes("--force");

	loadEnvFile(path.join(ROOT_DIR, ".env"));

	console.error("=== Action Image Upload Pipeline ===\n");
	if (dryRun) console.error("Mode: DRY RUN (compress only, no upload)\n");
	if (force) console.error("Mode: FORCE (ignoring cache)\n");

	// Load actions
	if (!fs.existsSync(ACTIONS_FILE)) {
		console.error(`Error: Actions file not found: ${ACTIONS_FILE}`);
		process.exit(1);
	}

	const actionsData = JSON.parse(
		fs.readFileSync(ACTIONS_FILE, "utf8"),
	) as ActionsData;
	console.error(`Found ${actionsData.actions.length} actions in actions.json\n`);

	// Stage 1: Compress
	const compressed = await compressImages(actionsData.actions);

	if (compressed.length === 0) {
		console.error("No images found to process. Check config/action-images/");
		process.exit(1);
	}

	// Dry run: show summary and exit
	if (dryRun) {
		console.error("--- Dry run complete ---\n");
		console.error(`Compressed images saved to: ${TEMP_DIR}\n`);

		const summary = compressed.map((c) => ({
			slug: c.slug,
			title: c.title,
			file: path.basename(c.webpPath),
			originalKB: Math.round(c.originalSize / 1024),
			compressedKB: Math.round(c.compressedSize / 1024),
		}));
		console.log(JSON.stringify(summary, null, 2));
		return;
	}

	// Stage 2: Upload
	const cache = force ? {} : loadCache();
	const cidMap = await uploadImages(compressed, cache);

	// Stage 3: Update actions.json
	updateActionsJson(actionsData, cidMap);

	// Save cache
	saveCache(cache);
	console.error(
		`Cache saved to ${path.relative(process.cwd(), CACHE_FILE)}\n`,
	);

	// Summary output
	const cidEntries = Object.entries(cidMap).map(([slug, cid]) => ({
		slug,
		cid,
	}));
	console.log(JSON.stringify(cidEntries, null, 2));

	console.error("=== Done ===\n");
}

main().catch((error) => {
	console.error("Fatal error:", error.message || error);
	process.exit(1);
});
