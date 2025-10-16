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

/**
 * Resolves an IPFS URL to a proper gateway URL for image display
 * Handles both ipfs:// and https://ipfs.io/ formats
 */
export function resolveIPFSUrl(url: string): string {
  if (!url) return "";

  // If it's already a proper gateway URL, return as is
  if (url.startsWith("https://greengoods.mypinata.cloud/")) {
    return url;
  }

  // Handle ipfs:// protocol
  if (url.startsWith("ipfs://")) {
    const hash = url.replace("ipfs://", "");
    return `https://greengoods.mypinata.cloud/ipfs/${hash}`;
  }

  // Handle https://ipfs.io/ URLs
  if (url.includes("ipfs.io/ipfs/")) {
    const hash = url.split("ipfs.io/ipfs/")[1];
    return `https://greengoods.mypinata.cloud/ipfs/${hash}`;
  }

  // Handle direct hash
  if (url.startsWith("Qm") || url.startsWith("baf")) {
    return `https://greengoods.mypinata.cloud/ipfs/${url}`;
  }

  // Return original URL if no IPFS pattern matched
  return url;
}
