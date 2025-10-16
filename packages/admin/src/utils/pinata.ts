import { PinataSDK } from "pinata";

export const pinata = new PinataSDK({
  pinataJwt: import.meta.env.VITE_PINATA_JWT as string,
  pinataGateway: "greengoods.mypinata.cloud",
});

export async function uploadFileToIPFS(file: File) {
  return await pinata.upload.private.file(file);
}

export async function uploadJSONToIPFS(json: Record<string, unknown>) {
  return await pinata.upload.private.json(json);
}

export async function getFileByHash(hash: string) {
  return await pinata.gateways.public.get(hash);
}

const DEFAULT_IMAGE_PROXY = "https://images.weserv.nl";

interface ResolveIPFSUrlOptions {
  width?: number;
  height?: number;
  quality?: number;
}

function applyImageProxy(url: string, options?: ResolveIPFSUrlOptions) {
  const base = (import.meta.env.VITE_IMAGE_PROXY_URL as string | undefined) || DEFAULT_IMAGE_PROXY;
  if (!base) {
    return url;
  }

  const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const params = new URLSearchParams();
  params.set("url", url);
  if (options?.width) {
    params.set("w", String(options.width));
  }
  if (options?.height) {
    params.set("h", String(options.height));
  }
  if (options?.quality) {
    params.set("q", String(options.quality));
  }

  return `${trimmedBase}/?${params.toString()}`;
}

/**
 * Resolves an IPFS URL to a proper gateway URL for image display
 * Handles both ipfs:// and https://ipfs.io/ formats
 */
export function resolveIPFSUrl(url: string, options?: ResolveIPFSUrlOptions): string {
  if (!url) return "";

  // If it's already a proper gateway URL, return as is
  if (url.startsWith("https://greengoods.mypinata.cloud/")) {
    return options ? applyImageProxy(url, options) : url;
  }

  // Handle ipfs:// protocol
  if (url.startsWith("ipfs://")) {
    const hash = url.replace("ipfs://", "");
    return `https://greengoods.mypinata.cloud/ipfs/${hash}`;
  }

  // Handle https://ipfs.io/ URLs
  if (url.includes("ipfs.io/ipfs/")) {
    const hash = url.split("ipfs.io/ipfs/")[1];
    const resolved = `https://greengoods.mypinata.cloud/ipfs/${hash}`;
    return options ? applyImageProxy(resolved, options) : resolved;
  }

  // Handle direct hash
  if (url.startsWith("Qm") || url.startsWith("baf")) {
    const resolved = `https://greengoods.mypinata.cloud/ipfs/${url}`;
    return options ? applyImageProxy(resolved, options) : resolved;
  }

  // Return original URL if no IPFS pattern matched
  return options ? applyImageProxy(url, options) : url;
}
