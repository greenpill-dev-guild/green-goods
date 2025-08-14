import { uploadFileToIPFS, uploadJSONToIPFS } from "@/modules/pinata";

export async function pinJSONToIPFS(obj: unknown): Promise<string> {
  const { cid } = await uploadJSONToIPFS(obj as Record<string, unknown>);
  return cid as string;
}

export async function pinFileToIPFS(file: File): Promise<string> {
  const { cid } = await uploadFileToIPFS(file);
  return cid as string;
}
