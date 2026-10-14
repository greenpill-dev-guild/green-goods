export function derivePublicGardenSlug(name: string | undefined, addressOrId: string): string {
  const fallback = addressOrId.trim().toLowerCase();
  const trimmed = (name ?? "").trim();
  if (!trimmed) return fallback;

  const slugified = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  let start = 0;
  while (start < slugified.length && slugified.charCodeAt(start) === 45) start++;
  let end = slugified.length;
  while (end > start && slugified.charCodeAt(end - 1) === 45) end--;
  return slugified.slice(start, end) || fallback;
}
