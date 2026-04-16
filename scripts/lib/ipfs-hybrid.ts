const DEFAULT_STORACHA_GATEWAY = "https://storacha.link";
const DEFAULT_PINATA_GATEWAY = "https://greengoods.mypinata.cloud";
const DEFAULT_PINATA_API_BASE_URL = "https://api.pinata.cloud";
const DEFAULT_PINATA_UPLOADS_API_BASE_URL = "https://uploads.pinata.cloud/v3";

export interface PinataScriptConfig {
  jwt: string | null;
  gatewayBaseUrl: string;
  apiBaseUrl: string;
}

interface PinataMetadataPayload {
  name?: string;
  keyvalues?: Record<string, string>;
}

interface PinataCidImportJob {
  id: string;
  cid: string;
  status: string;
  name?: string;
}

interface PinataUploadResponse {
  data?: { cid?: string };
  message?: string;
  error?: { reason?: string };
}

function trimLeadingSlashes(value: string): string {
  return value.replace(/^\/+/, "");
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function isPotentialIpfsCid(value: string): boolean {
  return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z0-9]{20,})$/i.test(value);
}

function parseIpfsPath(value: string) {
  const sanitized = trimLeadingSlashes(value.trim()).replace(/^ipfs\//i, "");
  if (!sanitized) return null;

  const [cid, ...pathParts] = sanitized.split("/").filter(Boolean);
  if (!cid || !isPotentialIpfsCid(cid)) return null;

  const path = pathParts.join("/");
  const canonicalId = path ? `${cid}/${path}` : cid;

  return {
    cid,
    path,
    canonicalId,
    canonicalUri: `ipfs://${canonicalId}`,
  };
}

export function parseIPFSReference(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("ipfs://")) {
    return parseIpfsPath(trimmed.slice("ipfs://".length));
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const pathname = trimLeadingSlashes(url.pathname);
      const subdomainMatch = url.hostname.match(/^([^.]+)\.ipfs\./i);

      if (pathname.startsWith("ipfs/")) {
        return parseIpfsPath(pathname.slice("ipfs/".length));
      }

      if (subdomainMatch?.[1]) {
        const cid = subdomainMatch[1];
        const path = trimLeadingSlashes(pathname);
        return parseIpfsPath(path ? `${cid}/${path}` : cid);
      }
    } catch {
      return null;
    }
  }

  return parseIpfsPath(trimmed);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimTrailingSlashes(trimmed) : null;
}

export function loadPinataConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): PinataScriptConfig | null {
  const jwt = env.PINATA_JWT?.trim() || env.VITE_PINATA_JWT?.trim() || null;
  const gatewayBaseUrl =
    normalizeUrl(env.PINATA_GATEWAY_URL) ??
    normalizeUrl(env.VITE_PINATA_GATEWAY_URL) ??
    (jwt ? DEFAULT_PINATA_GATEWAY : null);
  const apiBaseUrl =
    normalizeUrl(env.PINATA_API_URL) ??
    normalizeUrl(env.VITE_PINATA_API_URL) ??
    DEFAULT_PINATA_API_BASE_URL;

  if (!jwt && !gatewayBaseUrl) {
    return null;
  }

  return {
    jwt,
    gatewayBaseUrl: gatewayBaseUrl ?? DEFAULT_PINATA_GATEWAY,
    apiBaseUrl,
  };
}

export function buildGatewayUrl(reference: string, gatewayBaseUrl: string): string {
  const parsed = parseIPFSReference(reference);
  if (!parsed) return reference;
  return `${trimTrailingSlashes(gatewayBaseUrl)}/ipfs/${parsed.canonicalId}`;
}

async function queryPinataCidImportJob(
  config: PinataScriptConfig,
  cid: string
): Promise<PinataCidImportJob | null> {
  if (!config.jwt) return null;

  const endpoint = new URL("/v3/files/public/pin_by_cid", config.apiBaseUrl);
  endpoint.searchParams.set("cid", cid);
  endpoint.searchParams.set("order", "DESC");
  endpoint.searchParams.set("limit", "1");

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${config.jwt}`,
    },
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { message?: string; error?: { reason?: string } };
      message = payload.error?.reason?.trim() || payload.message?.trim() || message;
    } catch {
      // Ignore non-JSON error payloads.
    }

    throw new Error(`Pinata CID import status query failed for ${cid}: ${message}`);
  }

  const payload = (await response.json()) as { data?: { jobs?: PinataCidImportJob[] } };
  return payload.data?.jobs?.find((job) => job.cid === cid) ?? null;
}

async function importCidWithPinata(
  config: PinataScriptConfig | null | undefined,
  cid: string,
  options: {
    name?: string;
    metadata?: Record<string, string>;
  } = {}
): Promise<void> {
  if (!config?.jwt) return;

  const pinataMetadata: PinataMetadataPayload = {
    ...(options.name ? { name: options.name } : {}),
    ...(options.metadata && Object.keys(options.metadata).length > 0
      ? { keyvalues: options.metadata }
      : {}),
  };

  const response = await fetch(new URL("/v3/files/public/pin_by_cid", config.apiBaseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cid,
      ...(pinataMetadata.name ? { name: pinataMetadata.name } : {}),
      ...(pinataMetadata.keyvalues ? { keyvalues: pinataMetadata.keyvalues } : {}),
    }),
  });

  if (response.ok) return;

  let message = `${response.status} ${response.statusText}`;
  try {
    const payload = (await response.json()) as { error?: { reason?: string }; message?: string };
    message =
      payload.error?.reason?.trim() ||
      payload.message?.trim() ||
      message;
  } catch {
    // Ignore non-JSON error payloads.
  }

  if (response.status === 409 || /already|duplicate/i.test(message)) {
    return;
  }

  throw new Error(`Pinata CID import failed for ${cid}: ${message}`);
}

export async function uploadBufferWithPinata(
  config: PinataScriptConfig | null | undefined,
  buffer: Buffer,
  options: {
    filename: string;
    mimeType: string;
    name?: string;
    metadata?: Record<string, string>;
  }
): Promise<string> {
  if (!config?.jwt) {
    throw new Error("Pinata JWT is required for direct uploads");
  }

  const formData = new FormData();
  const blob = new Blob([buffer], { type: options.mimeType });
  formData.append("network", "public");
  formData.append("file", blob, options.filename);
  if (options.name) {
    formData.append("name", options.name);
  }

  const pinataMetadata: PinataMetadataPayload = {
    ...(options.metadata && Object.keys(options.metadata).length > 0
      ? { keyvalues: options.metadata }
      : {}),
  };

  if (Object.keys(pinataMetadata).length > 0) {
    formData.append("keyvalues", JSON.stringify(pinataMetadata.keyvalues ?? {}));
  }

  const response = await fetch(`${DEFAULT_PINATA_UPLOADS_API_BASE_URL}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.jwt}`,
    },
    body: formData,
  });

  let payload: PinataUploadResponse | null = null;
  try {
    payload = (await response.json()) as PinataUploadResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.error?.reason?.trim() ||
      payload?.message?.trim() ||
      `${response.status} ${response.statusText}`;
    throw new Error(`Pinata file upload failed for ${options.filename}: ${message}`);
  }

  const cid = payload?.data?.cid?.trim();
  if (!cid) {
    throw new Error(`Pinata upload for ${options.filename} did not return a CID`);
  }

  await verifyGatewayAvailability(`ipfs://${cid}`, config.gatewayBaseUrl, {
    label: "Pinata gateway",
  });

  return cid;
}

export async function verifyGatewayAvailability(
  reference: string,
  gatewayBaseUrl: string,
  options: {
    attempts?: number;
    timeoutMs?: number;
    label?: string;
  } = {}
): Promise<string> {
  const targetUrl = buildGatewayUrl(reference, gatewayBaseUrl);
  const attempts = options.attempts ?? 6;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const label = options.label ?? "IPFS gateway";
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(targetUrl, {
        signal: controller.signal,
        cache: "no-store",
      });

      if (response.ok) {
        try {
          await response.arrayBuffer();
        } catch {
          // Ignore response body read failures after an OK status.
        }

        return targetUrl;
      }

      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timeoutId);
    }

    if (attempt < attempts) {
      await sleep(1_000 * attempt);
    }
  }

  throw new Error(
    `Failed to verify ${label} availability for ${reference}: ${lastError?.message ?? "unknown error"}`
  );
}

export async function ensureHybridCidAvailability(
  cid: string,
  options: {
    storachaGatewayBaseUrl?: string;
    pinataConfig?: PinataScriptConfig | null;
    name?: string;
    metadata?: Record<string, string>;
    attempts?: number;
    timeoutMs?: number;
  } = {}
): Promise<{ storachaUrl: string; pinataUrl?: string }> {
  const canonicalUri = `ipfs://${cid}`;
  const storachaUrl = await verifyGatewayAvailability(
    canonicalUri,
    options.storachaGatewayBaseUrl ?? DEFAULT_STORACHA_GATEWAY,
    {
      attempts: options.attempts,
      timeoutMs: options.timeoutMs,
      label: "Storacha gateway",
    }
  );

  if (!options.pinataConfig?.jwt) {
    return { storachaUrl };
  }

  await importCidWithPinata(options.pinataConfig, cid, {
    name: options.name,
    metadata: options.metadata,
  });

  let pinataUrl: string;
  try {
    pinataUrl = await verifyGatewayAvailability(
      canonicalUri,
      options.pinataConfig.gatewayBaseUrl,
      {
        attempts: options.attempts,
        timeoutMs: options.timeoutMs,
        label: "Pinata gateway",
      }
    );
  } catch (error) {
    try {
      const importJob = await queryPinataCidImportJob(options.pinataConfig, cid);
      if (importJob?.status && importJob.status !== "backfilled") {
        throw new Error(
          `Failed to verify Pinata gateway availability for ${cid}: import job status is ${importJob.status}`
        );
      }
    } catch (statusError) {
      if (statusError instanceof Error) {
        throw statusError;
      }
    }

    throw error;
  }

  return { storachaUrl, pinataUrl };
}
