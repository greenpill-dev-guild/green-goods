/**
 * Media Service (IPFS via Storacha)
 *
 * Handles media uploads to IPFS for work submissions.
 * Node.js compatible - uses Buffer instead of browser File.
 */

import { loggers } from "./logger";

const log = loggers.platform;

// ============================================================================
// TYPES
// ============================================================================

export interface MediaUploadResult {
  cid: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface MediaBuffer {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

/** Minimal interface for Storacha client methods used by this service */
interface StorachaClient {
  addSpace(proof: unknown): Promise<{ did(): string }>;
  setCurrentSpace(did: string): Promise<void>;
  uploadFile(file: File): Promise<{ toString(): string }>;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

let storachaClient: StorachaClient | null = null;
let gatewayUrl = "https://w3s.link";

/**
 * Initialize media service with Storacha credentials
 */
export async function initMedia(key: string, proof: string, customGateway?: string): Promise<void> {
  try {
    // Dynamic imports for ES modules
    const [Client, Proof] = await Promise.all([
      import("@storacha/client"),
      import("@storacha/client/proof"),
    ]);

    // Cast to our minimal interface - runtime API is compatible
    storachaClient = (await Client.create()) as StorachaClient;

    // Parse and add proof to the client
    const parsedProof = await Proof.parse(proof);
    const space = await storachaClient.addSpace(parsedProof);
    await storachaClient.setCurrentSpace(space.did());

    if (customGateway) {
      gatewayUrl = customGateway;
    }
    log.info({ gateway: gatewayUrl }, "Media service initialized");
  } catch (error) {
    log.error({ err: error }, "Failed to initialize Storacha client");
    throw error;
  }
}

/**
 * Check if media service is configured
 */
export function isMediaConfigured(): boolean {
  return storachaClient !== null;
}

// ============================================================================
// UPLOADS
// ============================================================================

/**
 * Upload a buffer to IPFS via Storacha
 */
export async function uploadBufferToIPFS(media: MediaBuffer): Promise<MediaUploadResult> {
  if (!storachaClient) {
    throw new Error("Media service not initialized. Call initMedia() first.");
  }

  try {
    // Create a Blob from Buffer using Uint8Array (compatible with all Node.js versions)
    const uint8Array = new Uint8Array(media.buffer);
    const blob = new Blob([uint8Array], { type: media.mimeType });
    const file = new File([blob], media.filename, { type: media.mimeType });

    const cid = await storachaClient.uploadFile(file);
    const cidString = cid.toString();

    const result: MediaUploadResult = {
      cid: cidString,
      url: `${gatewayUrl}/ipfs/${cidString}`,
      mimeType: media.mimeType,
      size: media.buffer.length,
    };

    log.info(
      { cid: result.cid, size: result.size, filename: media.filename },
      "Media uploaded to IPFS"
    );

    return result;
  } catch (error) {
    log.error({ err: error, filename: media.filename }, "Failed to upload media to IPFS");
    throw error;
  }
}

/**
 * Upload multiple media buffers in parallel
 */
export async function uploadMediaBatch(media: MediaBuffer[]): Promise<MediaUploadResult[]> {
  if (media.length === 0) return [];

  const results = await Promise.allSettled(media.map((m) => uploadBufferToIPFS(m)));

  const successful: MediaUploadResult[] = [];
  const failed: Array<{ filename: string; error: string }> = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      successful.push(result.value);
    } else {
      failed.push({
        filename: media[index].filename,
        error: result.reason?.message || "Unknown error",
      });
    }
  });

  if (failed.length > 0) {
    log.warn({ failed }, `${failed.length} media uploads failed`);
  }

  return successful;
}

// ============================================================================
// URL RESOLUTION
// ============================================================================

/**
 * Resolve an IPFS CID or URL to a gateway URL
 */
export function resolveIPFSUrl(cidOrUrl: string): string {
  if (!cidOrUrl) return "";

  // Already a full URL
  if (cidOrUrl.startsWith("http://") || cidOrUrl.startsWith("https://")) {
    return cidOrUrl;
  }

  // Handle ipfs:// protocol
  if (cidOrUrl.startsWith("ipfs://")) {
    const cid = cidOrUrl.replace("ipfs://", "");
    return `${gatewayUrl}/ipfs/${cid}`;
  }

  // Raw CID (starts with Qm or baf)
  if (cidOrUrl.startsWith("Qm") || cidOrUrl.startsWith("baf")) {
    return `${gatewayUrl}/ipfs/${cidOrUrl}`;
  }

  return cidOrUrl;
}

/**
 * Get IPFS CIDs from media upload results
 */
export function getMediaCIDs(results: MediaUploadResult[]): string[] {
  return results.map((r) => r.cid);
}

// ============================================================================
// MIME TYPE DETECTION
// ============================================================================

/**
 * Detect MIME type from buffer magic bytes
 */
export function detectMimeType(buffer: Buffer): string {
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }

  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return "image/gif";
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  // Default to JPEG for unknown image types
  return "image/jpeg";
}

/**
 * Get file extension from MIME type
 */
export function getExtensionForMime(mimeType: string): string {
  const extensions: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
  };
  return extensions[mimeType] || ".bin";
}
