import type { PublicUploadSignRequest } from "@green-goods/shared/public-contracts";

export const DEFAULT_PINATA_UPLOADS_API_BASE_URL = "https://uploads.pinata.cloud/v3";
export const DEFAULT_UPLOAD_SIGN_TTL_SECONDS = 60;
export const DEFAULT_UPLOAD_SIGN_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const DEFAULT_UPLOAD_SIGN_ALLOWED_MIME_TYPES = [
  "image/*",
  "audio/*",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/json",
  "application/pdf",
];

export interface PinataUploadSignerConfig {
  jwt?: string;
  uploadsApiBaseUrl?: string;
  ttlSeconds?: number;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  fetch?: typeof fetch;
  now?: () => number;
}

export interface NormalizedUploadSignerConfig {
  jwt?: string;
  uploadsApiBaseUrl: string;
  ttlSeconds: number;
  maxFileSize: number;
  allowedMimeTypes: string[];
  fetch: typeof fetch;
  now: () => number;
}

type PinataSignedUploadUrlResponse = {
  data?: string;
  message?: string;
  error?: { reason?: string };
};

export class PinataUploadSignerConfigError extends Error {
  constructor(message = "Pinata upload signer is not configured") {
    super(message);
    this.name = "PinataUploadSignerConfigError";
  }
}

export function normalizeUploadSignerConfig(
  config: PinataUploadSignerConfig = {}
): NormalizedUploadSignerConfig {
  return {
    jwt: config.jwt?.trim() || undefined,
    uploadsApiBaseUrl: trimTrailingSlashes(
      config.uploadsApiBaseUrl || DEFAULT_PINATA_UPLOADS_API_BASE_URL
    ),
    ttlSeconds: positiveInteger(config.ttlSeconds) ?? DEFAULT_UPLOAD_SIGN_TTL_SECONDS,
    maxFileSize: positiveInteger(config.maxFileSize) ?? DEFAULT_UPLOAD_SIGN_MAX_FILE_SIZE,
    allowedMimeTypes:
      config.allowedMimeTypes?.map((entry) => entry.trim()).filter(Boolean) ??
      DEFAULT_UPLOAD_SIGN_ALLOWED_MIME_TYPES,
    fetch: config.fetch ?? fetch,
    now: config.now ?? Date.now,
  };
}

export async function createPinataSignedUploadUrl(
  request: PublicUploadSignRequest,
  config: PinataUploadSignerConfig
): Promise<string> {
  const normalized = normalizeUploadSignerConfig(config);
  if (!normalized.jwt) {
    throw new PinataUploadSignerConfigError();
  }

  const date = Math.floor(normalized.now() / 1000);
  const keyvalues = Object.fromEntries(
    Object.entries({
      category: request.category,
      source: request.source,
      gardenAddress: request.gardenAddress,
    }).filter(([, value]) => Boolean(value))
  ) as Record<string, string>;

  const response = await normalized.fetch(`${normalized.uploadsApiBaseUrl}/files/sign`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${normalized.jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      date,
      expires: normalized.ttlSeconds,
      max_file_size: normalized.maxFileSize,
      allow_mime_types: normalized.allowedMimeTypes,
      filename: request.filename,
      ...(Object.keys(keyvalues).length > 0 ? { keyvalues } : {}),
    }),
  });

  let payload: PinataSignedUploadUrlResponse | null = null;
  try {
    payload = (await response.json()) as PinataSignedUploadUrlResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.error?.reason?.trim() ||
      payload?.message?.trim() ||
      `${response.status} ${response.statusText}`;
    throw new Error(`Pinata signed upload URL creation failed: ${message}`);
  }

  const url = payload?.data?.trim();
  if (!url) {
    throw new Error("Pinata signed upload URL response did not include a URL");
  }

  return url;
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function positiveInteger(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}
