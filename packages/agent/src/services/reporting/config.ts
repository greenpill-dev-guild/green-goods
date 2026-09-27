import { join } from "node:path";

/**
 * Agent reporting configuration, read from the root `.env`. `AGENT_REPORTING_TRANSPORT` names the
 * chat transport and is the only on switch: empty keeps reporting off. Once it is set, every
 * required value must be present or startup fails closed. What an operator decides at runtime
 * (intake, model processing, documents, voice, publication) is a persistent operator control that
 * starts off, and model versions are pinned in code, so neither lives here.
 */
export interface ReportingConfig {
  dbPath: string;
  mediaDir: string;
  /** `version:base64key` pairs, current first; see `createReportingKeyring`. */
  keys: string;
  browserOrigin: string;
  interpretation:
    | { provider: "none" }
    | { provider: "jev"; apiKey: string; baseUrl: string; model: string };
  /** `transcriptionModel` is set only once a transcription model is pinned for voice notes. */
  openai: {
    apiKey: string;
    baseUrl: string;
    model: string;
    transcriptionModel: string | null;
  } | null;
  pinata: { jwt: string; uploadsApiBaseUrl?: string } | null;
  workerIntervalMs: number;
}

/**
 * The model versions this build uses. Each is pinned by a reviewed change that carries evaluation
 * results on consented or synthetic files, never by an environment value; `null` keeps that
 * provider off whatever keys are present.
 */
export interface ReportingModels {
  extraction: string | null;
  transcription: string | null;
  jev: string | null;
}

const PINNED_MODELS: ReportingModels = { extraction: null, transcription: null, jev: null };

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const JEV_BASE_URL = "https://api.typesafe.ai";
const WORKER_INTERVAL_MS = 2_000;

export class ReportingConfigError extends Error {}

function text(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * `dataDir` is the directory of the Agent's own database. Reporting keeps its database and private
 * media beside it, so they live on the same persistent volume (`/data` on Fly) instead of the
 * image's working directory, which a deploy replaces.
 */
export function loadReportingConfig(
  env: Record<string, string | undefined>,
  base: { isProduction: boolean; dataDir: string },
  models: ReportingModels = PINNED_MODELS
): { transport: string; config: ReportingConfig } | null {
  const transport = text(env.AGENT_REPORTING_TRANSPORT);
  if (!transport) return null;
  const missing: string[] = [];
  const need = (name: string): string => {
    const value = text(env[name]);
    if (!value) missing.push(name);
    return value ?? "";
  };
  const keys = need("AGENT_REPORTING_KEYS");
  const browserOrigin = need("AGENT_REPORTING_BROWSER_ORIGIN");
  if (missing.length > 0) {
    throw new ReportingConfigError(`Agent reporting is enabled but ${missing.join(", ")} missing`);
  }
  let origin: URL;
  try {
    origin = new URL(browserOrigin);
  } catch {
    throw new ReportingConfigError("AGENT_REPORTING_BROWSER_ORIGIN must be an absolute origin");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (origin.origin !== browserOrigin || (origin.protocol !== "https:" && !loopback)) {
    throw new ReportingConfigError(
      "AGENT_REPORTING_BROWSER_ORIGIN must be an exact https origin (http only on loopback)"
    );
  }
  if (base.isProduction && loopback) {
    throw new ReportingConfigError("A loopback browser origin is not allowed in production");
  }

  const jevKey = text(env.AGENT_REPORTING_JEV_API_KEY);
  const openaiKey = text(env.AGENT_REPORTING_OPENAI_API_KEY);
  const pinataJwt = text(env.PINATA_JWT);
  return {
    transport,
    config: {
      dbPath: join(base.dataDir, "reporting.db"),
      mediaDir: join(base.dataDir, "reporting-media"),
      keys,
      browserOrigin,
      interpretation:
        jevKey && models.jev
          ? { provider: "jev", apiKey: jevKey, baseUrl: JEV_BASE_URL, model: models.jev }
          : { provider: "none" },
      openai:
        openaiKey && models.extraction
          ? {
              apiKey: openaiKey,
              baseUrl: OPENAI_BASE_URL,
              model: models.extraction,
              transcriptionModel: models.transcription,
            }
          : null,
      pinata: pinataJwt
        ? {
            jwt: pinataJwt,
            ...(text(env.PINATA_UPLOADS_API_URL)
              ? { uploadsApiBaseUrl: text(env.PINATA_UPLOADS_API_URL) as string }
              : {}),
          }
        : null,
      workerIntervalMs: WORKER_INTERVAL_MS,
    },
  };
}
