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
