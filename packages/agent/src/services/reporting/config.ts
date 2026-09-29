import { join } from "node:path";

/**
 * Agent reporting configuration, read from the root `.env`. Only secrets live there: the key list,
 * whose absence keeps reporting off, and the model providers' keys. Which chat channels take
 * reports, and everything else an operator decides at runtime (intake, model processing,
 * documents, voice, publication), are persistent operator controls that start off; model versions
 * and the browser origin are fixed in code.
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

/**
 * Where ceremony links point and the only origin the ceremony API accepts: the installed app's
 * public origin, where people's passkeys live. Outside production that is the local Client dev
 * server; the loopback driver and the tests bring their own.
 */
const PRODUCTION_BROWSER_ORIGIN = "https://www.greengoods.app";
const LOCAL_BROWSER_ORIGIN = "https://localhost:3001";

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
): ReportingConfig | null {
  const keys = text(env.AGENT_REPORTING_KEYS);
  if (!keys) return null;
  const jevKey = text(env.AGENT_REPORTING_JEV_API_KEY);
  const openaiKey = text(env.AGENT_REPORTING_OPENAI_API_KEY);
  const pinataJwt = text(env.PINATA_JWT);
  return {
    dbPath: join(base.dataDir, "reporting.db"),
    mediaDir: join(base.dataDir, "reporting-media"),
    keys,
    browserOrigin: base.isProduction ? PRODUCTION_BROWSER_ORIGIN : LOCAL_BROWSER_ORIGIN,
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
  };
}
