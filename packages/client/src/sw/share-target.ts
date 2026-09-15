import {
  SHARE_ENVELOPE_PREFIX,
  SHARE_FILE_PREFIX,
  SHARE_TARGET_PATH,
  SW_CACHES,
} from "@green-goods/shared/modules/app/service-worker-protocol";

const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const MAX_FILES = 5;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const EXTENSION_TYPES = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".heic", "image/heic"],
  [".heif", "image/heif"],
]);

interface StoredShareFile {
  cacheKey: string;
  name: string;
  type: string;
  size: number;
}

interface ShareEnvelope {
  version: 1;
  token: string;
  createdAt: number;
  expiresAt: number;
  title: string;
  text: string;
  url: string;
  files: StoredShareFile[];
}

export function isShareTargetRequest(request: Request): boolean {
  if (request.method !== "POST") return false;
  try {
    return new URL(request.url).pathname === SHARE_TARGET_PATH;
  } catch {
    return false;
  }
}

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { location } });
}

function parseSharedUrl(value: FormDataEntryValue | null): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.length > 2048) throw new Error("url-too-long");
  const parsed = new URL(text);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("url-invalid");
  return parsed.toString();
}

function normalizeImageType(file: File): string | null {
  const suppliedType = String(file.type || "").toLowerCase();
  if (ALLOWED_TYPES.has(suppliedType)) return suppliedType;
  if (suppliedType && suppliedType !== "application/octet-stream") return null;
  const name = String(file.name || "").toLowerCase();
  const extension = [...EXTENSION_TYPES.keys()].find((candidate) => name.endsWith(candidate));
  return extension ? (EXTENSION_TYPES.get(extension) ?? null) : null;
}

async function cleanupExpiredEnvelopes(cache: Cache): Promise<void> {
  const now = Date.now();
  for (const request of await cache.keys()) {
    if (!new URL(request.url).pathname.startsWith(SHARE_ENVELOPE_PREFIX)) continue;
    try {
      const envelope = (await (await cache.match(request))?.json()) as Partial<ShareEnvelope>;
      if (Number(envelope?.expiresAt) > now) continue;
      await cache.delete(request);
      await Promise.all((envelope?.files ?? []).map((file) => cache.delete(file.cacheKey)));
    } catch {
      await cache.delete(request);
    }
  }
}

/**
 * Receive a Web Share Target submission: keep the shared text and photos in
 * the share inbox under one token, then send the app to the composer that
 * reads them. Anything malformed redirects with a reason instead of failing.
 */
export async function receiveShareTarget(
  scope: ServiceWorkerGlobalScope,
  request: Request
): Promise<Response> {
  try {
    const formData = await request.formData();
    const title = String(formData.get("title") ?? "").trim();
    const text = String(formData.get("text") ?? "").trim();
    const sharedUrl = parseSharedUrl(formData.get("url"));
    if (title.length > 300 || text.length > 10_000) throw new Error("text-too-long");

    const files = formData.getAll("images").filter((value): value is File => value instanceof File);
    if (files.length > MAX_FILES) throw new Error("too-many-files");
    let totalBytes = 0;
    const normalized: Array<{ file: File; type: string }> = [];
    for (const file of files) {
      totalBytes += file.size;
      const type = normalizeImageType(file);
      if (!type || file.size > MAX_FILE_BYTES) throw new Error("file-invalid");
      normalized.push({ file, type });
    }
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error("share-too-large");
    if (!title && !text && !sharedUrl && normalized.length === 0) throw new Error("share-empty");

    const token =
      scope.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const cache = await caches.open(SW_CACHES.SHARE_INBOX);
    await cleanupExpiredEnvelopes(cache);
    const storedFiles: StoredShareFile[] = [];
    const writtenKeys: string[] = [];
    try {
      for (const [index, { file, type }] of normalized.entries()) {
        const cacheKey = `${SHARE_FILE_PREFIX}${token}/${index}`;
        await cache.put(
          cacheKey,
          new Response(file, {
            headers: {
              "content-type": type,
              "x-gg-file-name": encodeURIComponent(file.name || `shared-${index}`),
            },
          })
        );
        writtenKeys.push(cacheKey);
        storedFiles.push({ cacheKey, name: file.name, type, size: file.size });
      }
      const now = Date.now();
      const envelope: ShareEnvelope = {
        version: 1,
        token,
        createdAt: now,
        expiresAt: now + EXPIRY_MS,
        title,
        text,
        url: sharedUrl,
        files: storedFiles,
      };
      const envelopeKey = `${SHARE_ENVELOPE_PREFIX}${token}`;
      await cache.put(
        envelopeKey,
        new Response(JSON.stringify(envelope), {
          headers: { "content-type": "application/json" },
        })
      );
      writtenKeys.push(envelopeKey);
    } catch (error) {
      await Promise.all(writtenKeys.map((key) => cache.delete(key)));
      throw error;
    }
    return redirect(`/home/garden?shareTarget=${encodeURIComponent(token)}`);
  } catch {
    return redirect(`/home/garden?shareTargetError=${encodeURIComponent("invalid")}`);
  }
}
