const SHARE_INBOX_CACHE = "gg-share-inbox-v1";
const SHARE_ENVELOPE_PREFIX = "/__gg_share_envelope__/";

export interface ShareTargetFileEntry {
  cacheKey: string;
  name: string;
  type: string;
  size: number;
}

/** Internal browser handoff shape. This is not a Green Goods domain model. */
export interface ShareTargetEnvelope {
  version: 1;
  token: string;
  createdAt: number;
  expiresAt: number;
  title: string;
  text: string;
  url: string;
  files: ShareTargetFileEntry[];
}

export interface LoadedShareTarget {
  envelope: ShareTargetEnvelope;
  files: File[];
  feedback: string;
}

function envelopeKey(token: string) {
  return `${SHARE_ENVELOPE_PREFIX}${encodeURIComponent(token)}`;
}

function isEnvelope(value: unknown, token: string): value is ShareTargetEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<ShareTargetEnvelope>;
  return (
    envelope.version === 1 &&
    envelope.token === token &&
    typeof envelope.expiresAt === "number" &&
    typeof envelope.title === "string" &&
    typeof envelope.text === "string" &&
    typeof envelope.url === "string" &&
    Array.isArray(envelope.files)
  );
}

export async function consumeShareTarget(token: string): Promise<void> {
  if (typeof caches === "undefined") return;
  const cache = await caches.open(SHARE_INBOX_CACHE);
  const response = await cache.match(envelopeKey(token));
  if (response) {
    try {
      const envelope = (await response.json()) as Partial<ShareTargetEnvelope>;
      await Promise.all((envelope.files ?? []).map((file) => cache.delete(file.cacheKey)));
    } catch {
      // The invalid envelope itself is still removed below.
    }
  }
  await cache.delete(envelopeKey(token));
}

export async function loadShareTarget(token: string): Promise<LoadedShareTarget | null> {
  if (!token || typeof caches === "undefined") return null;
  const cache = await caches.open(SHARE_INBOX_CACHE);
  const response = await cache.match(envelopeKey(token));
  if (!response) return null;

  const envelope = (await response.json()) as unknown;
  if (!isEnvelope(envelope, token) || envelope.expiresAt <= Date.now()) {
    await consumeShareTarget(token);
    return null;
  }

  const files = await Promise.all(
    envelope.files.map(async (entry) => {
      const fileResponse = await cache.match(entry.cacheKey);
      if (!fileResponse) throw new Error("Shared image is no longer available");
      return new File([await fileResponse.blob()], entry.name, {
        type: entry.type,
        lastModified: envelope.createdAt,
      });
    })
  );
  const feedback = [envelope.title, envelope.text, envelope.url].filter(Boolean).join("\n\n");
  return { envelope, files, feedback };
}
