/**
 * Automatic recovery for email accounts.
 *
 * An Openfort embedded wallet keeps one key share with Openfort's Shield service, encrypted with
 * a project secret that never reaches a browser. To configure or recover a wallet on a new
 * device, the app needs a single-use "encryption session" that only a holder of that secret can
 * mint. This service mints one for a caller that proves a live Openfort session.
 *
 * Nothing here logs or returns the access token, the session id, the Shield secret or the
 * encryption share.
 */

const DEFAULT_API_BASE_URL = "https://api.openfort.io";
const DEFAULT_SHIELD_BASE_URL = "https://shield.openfort.io";
const DEFAULT_TIMEOUT_MS = 10_000;

export interface OpenfortRecoveryConfig {
  /** The project's publishable key (`pk_...`), used to ask Openfort whose session a token is. */
  publishableKey: string;
  shieldPublishableKey: string;
  shieldSecretKey: string;
  shieldEncryptionShare: string;
  apiBaseUrl?: string;
  shieldBaseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export type OpenfortRecoveryErrorCode = "session_invalid" | "unavailable";

export class OpenfortRecoveryError extends Error {
  constructor(
    readonly code: OpenfortRecoveryErrorCode,
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "OpenfortRecoveryError";
  }
}

export interface OpenfortRecovery {
  /** The Openfort user an access token belongs to; refuses a token Openfort does not accept. */
  verifySession(accessToken: string): Promise<{ userId: string }>;
  /** One single-use Shield encryption session. */
  createEncryptionSession(): Promise<string>;
}

type Env = Record<string, string | undefined>;

/**
 * Recovery is on only when all four values are set. A partial set is a configuration mistake,
 * reported by name (never by value) so the deploy can be fixed.
 */
export function readOpenfortRecoveryConfig(env: Env = process.env): {
  config?: OpenfortRecoveryConfig;
  missing: string[];
} {
  const values = {
    publishableKey: env.VITE_OPENFORT_PUBLISHABLE_KEY?.trim(),
    shieldPublishableKey: env.VITE_OPENFORT_SHIELD_PUBLISHABLE_KEY?.trim(),
    shieldSecretKey: env.OPENFORT_SHIELD_SECRET_KEY?.trim(),
    shieldEncryptionShare: env.OPENFORT_SHIELD_ENCRYPTION_SHARE?.trim(),
  };
  const names: Record<keyof typeof values, string> = {
    publishableKey: "VITE_OPENFORT_PUBLISHABLE_KEY",
    shieldPublishableKey: "VITE_OPENFORT_SHIELD_PUBLISHABLE_KEY",
    shieldSecretKey: "OPENFORT_SHIELD_SECRET_KEY",
    shieldEncryptionShare: "OPENFORT_SHIELD_ENCRYPTION_SHARE",
  };
  const missing = (Object.keys(values) as (keyof typeof values)[])
    .filter((key) => !values[key])
    .map((key) => names[key]);
  if (missing.length > 0) return { missing };
  return { config: values as OpenfortRecoveryConfig, missing };
}

export function createOpenfortRecovery(config: OpenfortRecoveryConfig): OpenfortRecovery {
  const request = config.fetch ?? fetch;
  const apiBaseUrl = (config.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(/\/+$/, "");
  const shieldBaseUrl = (config.shieldBaseUrl ?? DEFAULT_SHIELD_BASE_URL).replace(/\/+$/, "");
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const send = async (url: string, init: RequestInit): Promise<Response> => {
    try {
      return await request(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      throw new OpenfortRecoveryError("unavailable", "Openfort did not answer");
    }
  };

  return {
    async verifySession(accessToken) {
      const response = await send(`${apiBaseUrl}/iam/v2/auth/get-session`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "x-project-key": config.publishableKey,
        },
      });
      if (response.status >= 500) {
        throw new OpenfortRecoveryError(
          "unavailable",
          "Openfort session check failed",
          response.status
        );
      }
      // Openfort answers 200 with a null body for a missing, malformed or expired token.
      const body = (await response.json().catch(() => null)) as {
        session?: unknown;
        user?: { id?: unknown };
      } | null;
      const userId = response.ok && body?.session ? body.user?.id : undefined;
      if (typeof userId !== "string" || userId.length === 0) {
        // A refusal status (not the 200 a bad token gets) points at this agent's configuration.
        throw new OpenfortRecoveryError(
          "session_invalid",
          "Openfort did not accept the session",
          response.ok ? undefined : response.status
        );
      }
      return { userId };
    },

    async createEncryptionSession() {
      const response = await send(`${shieldBaseUrl}/project/encryption-session`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": config.shieldPublishableKey,
          "x-api-secret": config.shieldSecretKey,
        },
        body: JSON.stringify({ encryption_part: config.shieldEncryptionShare }),
      });
      if (!response.ok) {
        throw new OpenfortRecoveryError(
          "unavailable",
          "Shield refused the session",
          response.status
        );
      }
      const body = (await response.json().catch(() => null)) as { session_id?: unknown } | null;
      if (typeof body?.session_id !== "string" || body.session_id.length === 0) {
        throw new OpenfortRecoveryError("unavailable", "Shield returned no session");
      }
      return body.session_id;
    },
  };
}
