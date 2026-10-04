import { join } from "node:path";

/**
 * Agent reporting configuration, read from the root `.env`. Secrets live there: the key list,
 * whose absence keeps reporting off, and the model providers' keys. So does one closed choice,
 * `AGENT_REPORTING_SITE`: the Green Goods site this deployment runs its ceremonies on. Which chat
 * channels take reports, and everything else an operator decides at runtime (intake, model
 * processing, documents, voice, publication), are persistent operator controls. New databases use
 * Telegram-first rollout defaults; voice and WhatsApp start off. Model versions and each site's
 * address are fixed in code.
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
 * The model versions this build uses, never selected by an environment value. Provider adapters
 * are tested with synthetic fixtures; live quality evaluation still requires operator credentials
 * and consented or synthetic files. `null` explicitly disables a provider in a test configuration.
 */
export interface ReportingModels {
  extraction: string | null;
  transcription: string | null;
  jev: string | null;
}

// Verified against the providers' model catalogs on 2026-10-02. These economical snapshots
// support the existing Responses JSON-schema/image/PDF and Audio JSON contracts without a
// reasoning-token budget. The newer gpt-transcribe currently exposes no dated snapshot.
// https://developers.openai.com/api/docs/models/gpt-4.1-mini
// https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe
// https://docs.typesafe.ai/models
const PINNED_MODELS: ReportingModels = {
  extraction: "gpt-4.1-mini-2025-04-14",
  transcription: "gpt-4o-mini-transcribe-2025-12-15",
  jev: "jev-1.13.0",
};

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const JEV_BASE_URL = "https://api.typesafe.ai";
const WORKER_INTERVAL_MS = 2_000;

/**
 * The Green Goods sites a deployed Agent can run ceremonies on. A deployment serves exactly one:
 * its ceremony links point there and the ceremony API accepts no other origin.
 * `AGENT_REPORTING_SITE` names the site and the addresses are fixed here, so no environment value
 * can send a ceremony to another host. `production` is the public site, built from `main`, where
 * people's passkeys live. `beta` is the staging site, built from `develop`: it lets a release be
 * tested against the live Agent before `main` carries it, and while it is selected a ceremony on
 * the public site is refused. Outside production the origin is the local Client dev server,
 * whichever site is named; the loopback driver and the tests bring their own.
 */
const SITE_ORIGINS = {
  production: "https://www.greengoods.app",
  beta: "https://beta.greengoods.app",
} as const;
type ReportingSite = keyof typeof SITE_ORIGINS;
const LOCAL_BROWSER_ORIGIN = "https://localhost:3001";

function text(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** An unset site is the public one. A name this build does not know is refused, never guessed. */
function reportingSite(value: string | undefined): ReportingSite {
  const name = text(value) ?? "production";
  if (!Object.hasOwn(SITE_ORIGINS, name)) {
    throw new Error(`AGENT_REPORTING_SITE must be one of: ${Object.keys(SITE_ORIGINS).join(", ")}`);
  }
  return name as ReportingSite;
}

/** Provider-only evaluation does not need a database, wrapping keys or chat credentials. */
export function loadReportingProviders(
  env: Record<string, string | undefined>,
  models: ReportingModels = PINNED_MODELS
): Pick<ReportingConfig, "interpretation" | "openai"> {
  const jevKey = text(env.AGENT_REPORTING_JEV_API_KEY);
  const openaiKey = text(env.AGENT_REPORTING_OPENAI_API_KEY);
  return {
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
  };
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
  const site = reportingSite(env.AGENT_REPORTING_SITE);
  const pinataJwt = text(env.PINATA_JWT);
  return {
    dbPath: join(base.dataDir, "reporting.db"),
    mediaDir: join(base.dataDir, "reporting-media"),
    keys,
    browserOrigin: base.isProduction ? SITE_ORIGINS[site] : LOCAL_BROWSER_ORIGIN,
    ...loadReportingProviders(env, models),
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
