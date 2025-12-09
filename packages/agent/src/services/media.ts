/**
 * Media Service (IPFS via Pinata)
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

// ============================================================================
// CONFIGURATION
// ============================================================================

let pinataJwt: string | null = null;
let gatewayUrl = "https://w3s.link";

/**
 * Initialize media service with Pinata credentials
 */
export function initMedia(jwt: string, customGateway?: string): void {
  pinataJwt = jwt;
  if (customGateway) {
    gatewayUrl = customGateway;
  }
  log.info({ gateway: gatewayUrl }, "Media service initialized");
}

/**
 * Check if media service is configured
 */
export function isMediaConfigured(): boolean {
  return pinataJwt !== null;
}

// ============================================================================
// UPLOADS
// ============================================================================

/**
 * Upload a buffer to IPFS via Pinata
 */
export async function uploadBufferToIPFS(media: MediaBuffer): Promise<MediaUploadResult> {
  if (!pinataJwt) {
    throw new Error("Media service not initialized. Call initMedia() first.");
  }

  const formData = new FormData();

  // Create a Blob from Buffer using Uint8Array (compatible with all Node.js versions)
  const uint8Array = new Uint8Array(media.buffer);
  const blob = new Blob([uint8Array], { type: media.mimeType });
  formData.append("file", blob, media.filename);

  const metadata = JSON.stringify({
    name: media.filename,
    keyvalues: {
      source: "green-goods-agent",
      uploadedAt: new Date().toISOString(),
    },
  });
  formData.append("pinataMetadata", metadata);

  const options = JSON.stringify({
    cidVersion: 1,
  });
  formData.append("pinataOptions", options);

  try {
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pinataJwt}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Pinata upload failed: ${res.status} ${errorText}`);
    }

    const data = (await res.json()) as { IpfsHash: string; PinSize: number };

    const result: MediaUploadResult = {
      cid: data.IpfsHash,
      url: `${gatewayUrl}/ipfs/${data.IpfsHash}`,
      mimeType: media.mimeType,
      size: data.PinSize,
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
