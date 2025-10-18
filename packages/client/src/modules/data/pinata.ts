import { PinataSDK } from "pinata";

const isDev = import.meta.env.DEV;
const devOrigin =
  typeof window !== "undefined" && window.location.origin
    ? window.location.origin
    : "https://localhost:3001";

export const pinata = new PinataSDK({
  pinataJwt: import.meta.env.VITE_PINATA_JWT as string,
  pinataGateway: isDev ? `${devOrigin}/pinata/gateway` : "greengoods.mypinata.cloud",
  uploadUrl: isDev ? `${devOrigin}/pinata/uploads/v3` : undefined,
  endpointUrl: isDev ? `${devOrigin}/pinata/api/v3` : undefined,
});

/** Uploads a file to IPFS using the configured Pinata client. */
export async function uploadFileToIPFS(file: File) {
  return await pinata.upload.private.file(file);
}

/** Uploads JSON metadata to IPFS and returns the resulting CID. */
export async function uploadJSONToIPFS(json: Record<string, unknown>) {
  return await pinata.upload.private.json(json);
}

/** Reads a file from the Pinata gateway by its CID or hash. */
export async function getFileByHash(hash: string) {
  return await pinata.gateways.public.get(hash);
}
