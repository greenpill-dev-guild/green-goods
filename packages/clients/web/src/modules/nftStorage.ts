import { NFTStorage, File } from "nft.storage";

export const client = new NFTStorage({
  token: import.meta.env.VITE_NFT_STORAGE_API_KEY ?? "",
});

export async function uploadMedia(
  media: File,
  name?: string,
  description?: string,
) {
  const metadata = await client.store({
    name: name ?? "Unknown",
    description: description ?? "No description",
    image: media,
  });

  console.log(metadata.url);

  return metadata.url;
}
