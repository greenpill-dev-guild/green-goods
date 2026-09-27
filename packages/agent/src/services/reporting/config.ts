import { join } from "node:path";
import type { ControlName } from "./controls";
import type { ReportingKeyringConfig } from "./keyring";
import type { EnabledGarden } from "./runtime";

/**
 * Agent reporting configuration, read from the root `.env`. Reporting is off unless
 * `AGENT_REPORTING_ENABLED=true`; once on, every required value must be present or startup fails
 * closed. Model processing, publication, voice and document conversion each start disabled and
 * need an explicit operator decision, independent of whether their credentials exist.
 */
export interface ReportingConfig {
  dbPath: string;
  mediaDir: string;
  keys: ReportingKeyringConfig;
  browserOrigin: string;
  gardens: EnabledGarden[];
  supportContact: string | null;
  /** Initial operating switches for a new database; later changes are persistent operator actions. */
  initialControls: Record<ControlName, boolean>;
  interpretation:
    | { provider: "none" }
    | { provider: "jev"; apiKey: string; baseUrl: string; model: string };
  /** `transcriptionModel` is set only for voice notes, which need their own pinned model. */
  openai: {
    apiKey: string;
    baseUrl: string;
    model: string;
    transcriptionModel: string | null;
  } | null;
  pinata: { jwt: string; uploadsApiBaseUrl?: string } | null;
  bundlerRpcUrl: string | null;
  voiceEnabled: boolean;
  /** PDF and Word reading with the pinned Poppler tools; off until the image proves them. */
  documentsEnabled: boolean;
  conversionEnabled: boolean;
  workerIntervalMs: number;
}

export class ReportingConfigError extends Error {}

const GARDEN_PATTERN = /^([a-z0-9-]{1,32})\|(0x[0-9a-fA-F]{40})\|(.{1,64})$/;

function flag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function text(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** `key|0xaddress|Label` entries separated by `;`, all on the Agent's single default chain. */
function parseReportingGardens(raw: string, chainId: number): EnabledGarden[] {
  const gardens = raw
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = GARDEN_PATTERN.exec(entry);
      if (!match) throw new ReportingConfigError(`Invalid AGENT_REPORTING_GARDENS entry: ${entry}`);
      const [, key, address, label] = match as unknown as [string, string, string, string];
      return {
        key,
        chainId,
        address: address.toLowerCase() as `0x${string}`,
        label: label.trim(),
      };
    });
  const keys = new Set(gardens.map((garden) => garden.key));
  if (gardens.length === 0 || keys.size !== gardens.length) {
    throw new ReportingConfigError("AGENT_REPORTING_GARDENS needs distinct garden keys");
  }
  return gardens;
}

/**
 * `dataDir` is the directory of the Agent's own database. Reporting keeps its database and private
 * media beside it, so they live on the same persistent volume (`/data` on Fly) instead of the
 * image's working directory, which a deploy replaces.
 */
export function loadReportingConfig(
  env: Record<string, string | undefined>,
  base: { chainId: number; isProduction: boolean; dataDir: string }
): ReportingConfig | null {
  if (!flag(env.AGENT_REPORTING_ENABLED)) return null;
  const missing: string[] = [];
  const need = (name: string): string => {
    const value = text(env[name]);
    if (!value) missing.push(name);
    return value ?? "";
  };
  const keys: ReportingKeyringConfig = {
    encryptionKeys: need("AGENT_REPORTING_ENCRYPTION_KEYS"),
    currentEncryptionVersion: need("AGENT_REPORTING_ENCRYPTION_KEY_VERSION"),
    lookupKeys: need("AGENT_REPORTING_LOOKUP_KEYS"),
    currentLookupVersion: need("AGENT_REPORTING_LOOKUP_KEY_VERSION"),
  };
  const browserOrigin = need("AGENT_REPORTING_BROWSER_ORIGIN");
  const gardensRaw = need("AGENT_REPORTING_GARDENS");
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
  const openaiModel = text(env.AGENT_REPORTING_OPENAI_MODEL);
  if (openaiKey && !openaiModel) {
    // The model is an explicit, reviewed choice; the Agent never guesses a model name.
    throw new ReportingConfigError("AGENT_REPORTING_OPENAI_MODEL is required with an OpenAI key");
  }
  const transcriptionModel = text(env.AGENT_REPORTING_OPENAI_TRANSCRIPTION_MODEL);
  const voiceEnabled = flag(env.AGENT_REPORTING_VOICE_ENABLED);
  if (voiceEnabled && !(openaiKey && openaiModel && transcriptionModel)) {
    // Voice has no local fallback: without transcription it stays off rather than half-working.
    throw new ReportingConfigError(
      "AGENT_REPORTING_VOICE_ENABLED needs AGENT_REPORTING_OPENAI_API_KEY and AGENT_REPORTING_OPENAI_TRANSCRIPTION_MODEL"
    );
  }
  const pinataJwt = text(env.PINATA_JWT);
  return {
    dbPath: join(base.dataDir, "reporting.db"),
    mediaDir: join(base.dataDir, "reporting-media"),
    keys,
    browserOrigin,
    gardens: parseReportingGardens(gardensRaw, base.chainId),
    supportContact: text(env.AGENT_REPORTING_SUPPORT_CONTACT),
    initialControls: {
      intake: flag(env.AGENT_REPORTING_INTAKE_ENABLED),
      model_processing: false,
      publication: false,
      outbound_messages: true,
    },
    interpretation: jevKey
      ? {
          provider: "jev",
          apiKey: jevKey,
          baseUrl: text(env.AGENT_REPORTING_JEV_BASE_URL) ?? "https://api.typesafe.ai",
          model: text(env.AGENT_REPORTING_JEV_MODEL) ?? "jev-latest",
        }
      : { provider: "none" },
    openai:
      openaiKey && openaiModel
        ? {
            apiKey: openaiKey,
            baseUrl: text(env.AGENT_REPORTING_OPENAI_BASE_URL) ?? "https://api.openai.com/v1",
            model: openaiModel,
            transcriptionModel,
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
    bundlerRpcUrl: text(env.AGENT_REPORTING_BUNDLER_RPC_URL),
    voiceEnabled,
    documentsEnabled: flag(env.AGENT_REPORTING_DOCUMENTS_ENABLED),
    conversionEnabled: flag(env.AGENT_REPORTING_CONVERSION_ENABLED),
    workerIntervalMs: Number(text(env.AGENT_REPORTING_WORKER_INTERVAL_MS) ?? 2_000),
  };
}
