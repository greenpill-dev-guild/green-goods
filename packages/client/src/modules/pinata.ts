import { PinataSDK } from "pinata";

export const pinata = new PinataSDK({
  pinataJwt: import.meta.env.VITE_PINATA_JWT as string,
});

export async function uploadFileToIPFS(file: File) {
  return await pinata.upload.file(file);
}

export async function uploadFilesToIPFS(files: File[]) {
  return await pinata.upload.fileArray(files);
}

export async function uploadJSONToIPFS(json: Record<string, any>) {
  return await pinata.upload.json(json);
}

export async function getFileByHash(hash: string) {
  return await pinata.gateways.get(hash);
}
