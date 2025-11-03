import { PinataSDK } from "pinata";

interface PinataConfig {
  jwt: string;
  gatewayBaseUrl: string;
  uploadUrl?: string;
  endpointUrl?: string;
}

let pinataInstance: PinataSDK | null = null;

/**
 * Initializes the singleton Pinata SDK instance
 * Supports dev proxy for local development
 */
export function initializePinata(config: PinataConfig) {
  if (!pinataInstance) {
    pinataInstance = new PinataSDK({
      pinataJwt: config.jwt,
      pinataGateway: config.gatewayBaseUrl,
      uploadUrl: config.uploadUrl,
      endpointUrl: config.endpointUrl,
    });
  }
  return pinataInstance;
}

/**
 * Gets the current Pinata client instance
 * Throws if not initialized
 */
export function getPinataClient(): PinataSDK {
  if (!pinataInstance) {
    throw new Error("Pinata client not initialized. Call initializePinata() first.");
  }
  return pinataInstance;
}

/** Uploads a file to IPFS using the configured Pinata client. */
export async function uploadFileToIPFS(file: File) {
  return await getPinataClient().upload.public.file(file);
}

/** Uploads JSON metadata to IPFS and returns the resulting CID. */
export async function uploadJSONToIPFS(json: Record<string, unknown>) {
  return await getPinataClient().upload.public.json(json);
}

/** Reads a file from the Pinata gateway by its CID or hash. */
export async function getFileByHash(hash: string) {
  return await getPinataClient().gateways.public.get(hash);
}

/**
 * Resolves an IPFS URL to a proper gateway URL for image display
 * Handles ipfs://, https://ipfs.io/, and direct hash formats
 */
export function resolveIPFSUrl(url: string, gatewayBaseUrl: string): string {
  if (!url) return "";

  // If it's already a proper gateway URL, return as is
  if (url.startsWith(gatewayBaseUrl)) {
    return url;
  }

  // Handle ipfs:// protocol
  if (url.startsWith("ipfs://")) {
    const hash = url.replace("ipfs://", "");
    return `${gatewayBaseUrl}/ipfs/${hash}`;
  }

  // Handle https://ipfs.io/ URLs
  if (url.includes("ipfs.io/ipfs/")) {
    const hash = url.split("ipfs.io/ipfs/")[1];
    return `${gatewayBaseUrl}/ipfs/${hash}`;
  }

  // Handle direct hash
  if (url.startsWith("Qm") || url.startsWith("baf")) {
    return `${gatewayBaseUrl}/ipfs/${url}`;
  }

  // Return original URL if no IPFS pattern matched
  return url;
}

