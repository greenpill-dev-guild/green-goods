export async function normalizeProfileAvatarFile(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image could not be decoded.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Image processing is unavailable.");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    512,
    512
  );
  bitmap.close();
  let quality = 0.92;
  let blob: Blob | null = null;
  while (quality >= 0.4) {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality)
    );
    if (blob && blob.type === "image/webp" && blob.size <= 1_000_000) break;
    quality -= 0.08;
  }
  if (!blob || blob.type !== "image/webp")
    throw new Error("This browser could not encode the image as WebP.");
  if (blob.size > 1_000_000) throw new Error("This image could not be reduced below 1 MB.");
  return new File([blob], "profile-avatar.webp", { type: "image/webp", lastModified: Date.now() });
}
