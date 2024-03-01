import { NFTStorage, File } from "nft.storage";

export const client = new NFTStorage({
  token: import.meta.env.VITE_NFT_STORAGE_API_KEY ?? "",
});

export interface FileUpload {
  file: File;
  name?: string;
  description?: string;
}

export async function uploadMedia(media: FileUpload[]) {
  const metadata = media.map(async ({ name, description, file }) => {
    const metadata = await client.store({
      name: name ?? "Unknown",
      description: description ?? "No description",
      image: file,
    });

    return metadata.url.toString();
  });

  return await Promise.all(metadata);
}
