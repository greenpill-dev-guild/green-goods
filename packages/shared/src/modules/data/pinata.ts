import { type Hex } from "viem";

interface PinataConfig {
  jwt: string;
  gatewayBaseUrl?: string;
}

let pinataJwt: string | null = null;
let gatewayUrl = "https://gateway.pinata.cloud";

const DEFAULT_AVATAR = "/images/avatar.png";

/**
 * Initializes the Pinata client configuration
 */
export async function initializePinata(config: PinataConfig) {
  pinataJwt = config.jwt;
  if (config.gatewayBaseUrl) {
    gatewayUrl = config.gatewayBaseUrl;
  }
  return { jwt: pinataJwt, gatewayUrl };
}

/**
 * Uploads a file to IPFS using Pinata API
 */
export async function uploadFileToIPFS(file: File): Promise<{ cid: string }> {
  if (!pinataJwt) {
    throw new Error("Pinata not initialized. Call initializePinata() first.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const metadata = JSON.stringify({
    name: file.name,
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
      throw new Error(`Pinata upload failed: ${res.statusText}`);
    }

    const data = (await res.json()) as any;
    return { cid: data.IpfsHash };
  } catch (error) {
    console.error("Failed to upload file to Pinata:", error);
    throw error;
  }
}

/**
 * Uploads JSON metadata to IPFS using Pinata API
 */
export async function uploadJSONToIPFS(json: Record<string, unknown>): Promise<{ cid: string }> {
  if (!pinataJwt) {
    throw new Error("Pinata not initialized. Call initializePinata() first.");
  }

  try {
    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pinataJwt}`,
      },
      body: JSON.stringify({
        pinataContent: json,
        pinataOptions: {
          cidVersion: 1,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Pinata upload failed: ${res.statusText}`);
    }

    const data = (await res.json()) as any;
    return { cid: data.IpfsHash };
  } catch (error) {
    console.error("Failed to upload JSON to Pinata:", error);
    throw error;
  }
}

/**
 * Resolves an IPFS URL to a proper gateway URL for image display
 */
export function resolveIPFSUrl(url: string, customGateway?: string): string {
  if (!url) return "";

  const base = customGateway || gatewayUrl;

  // Helper to clean/format the hash path
  const formatUrl = (hashPath: string) => {
    // Remove leading slash if present
    const cleanPath = hashPath.startsWith("/") ? hashPath.substring(1) : hashPath;
    return `${base}/ipfs/${cleanPath}`;
  };

  // Handle ipfs:// protocol
  if (url.startsWith("ipfs://")) {
    return formatUrl(url.replace("ipfs://", ""));
  }

  // Handle https://ipfs.io/ URLs
  if (url.includes("ipfs.io/ipfs/")) {
    return formatUrl(url.split("ipfs.io/ipfs/")[1]);
  }

  // Handle direct hash (CID) with optional path
  // Basic check for CID-like strings (starts with Qm or baf)
  if (url.startsWith("Qm") || url.startsWith("baf")) {
    return formatUrl(url);
  }

  // Return original URL if no IPFS pattern matched
  return url;
}

/**
 * Fetches a file from IPFS by its hash/CID using the gateway
 */
export async function getFileByHash(hash: string): Promise<{ data: Blob | string }> {
  const url = resolveIPFSUrl(hash);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch file from IPFS: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type");

  // Return as blob for binary data, text for JSON/text
  if (contentType?.includes("application/json") || contentType?.includes("text/")) {
    const text = await response.text();
    return { data: text };
  }

  const blob = await response.blob();
  return { data: blob };
}

/**
 * Resolves avatar URL from various formats (ipfs://, ar://, http, etc.)
 */
export function resolveAvatarUrl(
  uri?: string | null,
  defaultAvatar: string = DEFAULT_AVATAR
): string {
  if (!uri) return defaultAvatar;
  const resolved = resolveIPFSUrl(uri);
  return resolved === uri && !uri.startsWith("http") ? defaultAvatar : resolved;
}

/**
 * Resolves image URL from various formats
 */
export function resolveImageUrl(uri: string): string {
  if (!uri) return "";
  return resolveIPFSUrl(uri);
}

// Backward compatibility aliases if needed
export const initializeStoracha = initializePinata;
export const getStorachaClient = () => {
  throw new Error("Pinata client does not expose a raw client instance");
};

/**
 * Convenience initializer that reads Vite-style env vars.
 * Returns true on successful initialization, false if missing configuration.
 */
export async function initializePinataFromEnv(
  env: any = typeof import.meta !== "undefined" ? import.meta.env : {}
) {
  const jwt = env?.VITE_PINATA_JWT;
  const gatewayBaseUrl = env?.VITE_PINATA_GATEWAY;

  if (!jwt) {
    console.warn("VITE_PINATA_JWT is not configured. Media features will be unavailable.");
    return false;
  }

  try {
    await initializePinata({ jwt, gatewayBaseUrl });
    return true;
  } catch (err) {
    console.error("Failed to initialize Pinata:", err);
    return false;
  }
}
