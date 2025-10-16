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

export async function uploadFileToIPFS(file: File) {
  return await pinata.upload.private.file(file);
}

export async function uploadJSONToIPFS(json: Record<string, unknown>) {
  return await pinata.upload.private.json(json);
}

export async function getFileByHash(hash: string) {
  return await pinata.gateways.public.get(hash);
}
