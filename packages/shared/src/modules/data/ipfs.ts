import * as Client from "@storacha/client";

interface IpfsConfig {
  key: string;
  proof: string;
  gatewayBaseUrl?: string;
}

let storachaClient: Client.Client | null = null;
let gatewayUrl = "https://w3s.link";

const DEFAULT_AVATAR = "/images/avatar.png";

/**
 * Initializes the Storacha IPFS client configuration
 */
export async function initializeIpfs(config: IpfsConfig) {
  try {
    storachaClient = await Client.create();

    // Add proof and key to the client
    const proof = Client.Proof.parse(config.proof);
    const space = await storachaClient.addSpace(proof);
    await storachaClient.setCurrentSpace(space.did());

    if (config.gatewayBaseUrl) {
      gatewayUrl = config.gatewayBaseUrl;
    }

    return { client: storachaClient, gatewayUrl };
  } catch (error) {
    console.error("Failed to initialize Storacha client:", error);
    throw error;
  }
}

/**
 * Uploads a file to IPFS using Storacha
 */
export async function uploadFileToIPFS(file: File): Promise<{ cid: string }> {
  if (!storachaClient) {
    throw new Error("Storacha not initialized. Call initializeIpfs() first.");
  }

  try {
    const cid = await storachaClient.uploadFile(file);
    return { cid: cid.toString() };
  } catch (error) {
    console.error("Failed to upload file to Storacha:", error);
    throw error;
  }
}

/**
 * Uploads JSON metadata to IPFS using Storacha
 */
export async function uploadJSONToIPFS(json: Record<string, unknown>): Promise<{ cid: string }> {
  if (!storachaClient) {
    throw new Error("Storacha not initialized. Call initializeIpfs() first.");
  }

  try {
    // Convert JSON to a File/Blob for upload
    const jsonString = JSON.stringify(json);
    const blob = new Blob([jsonString], { type: "application/json" });
    const file = new File([blob], "metadata.json", { type: "application/json" });

    const cid = await storachaClient.uploadFile(file);
    return { cid: cid.toString() };
  } catch (error) {
    console.error("Failed to upload JSON to Storacha:", error);
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

/**
 * Convenience initializer that reads Vite-style env vars.
 * Returns true on successful initialization, false if missing configuration.
 */
export async function initializeIpfsFromEnv(
  env: any = typeof import.meta !== "undefined" ? import.meta.env : {}
) {
  const key = env?.VITE_STORACHA_KEY;
  const proof = env?.VITE_STORACHA_PROOF;
  const gatewayBaseUrl = env?.VITE_STORACHA_GATEWAY;

  if (!key || !proof) {
    console.warn(
      "VITE_STORACHA_KEY and VITE_STORACHA_PROOF are not configured. Media features will be unavailable."
    );
    return false;
  }

  try {
    await initializeIpfs({ key, proof, gatewayBaseUrl });
    return true;
  } catch (err) {
    console.error("Failed to initialize Storacha:", err);
    return false;
  }
}

// Storacha aliases (preferred naming)
export const initializeStoracha = initializeIpfs;
export const initializeStorachaFromEnv = initializeIpfsFromEnv;

// Backward compatibility aliases (deprecated - will be removed in future version)
/** @deprecated Use initializeIpfs or initializeStoracha instead */
export const initializePinata = initializeIpfs;
/** @deprecated Use initializeIpfsFromEnv or initializeStorachaFromEnv instead */
export const initializePinataFromEnv = initializeIpfsFromEnv;
