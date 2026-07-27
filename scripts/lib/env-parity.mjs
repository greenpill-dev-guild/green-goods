import { parseSchema, requiredKeysForProfile, validateRequiredEnvironment } from "./env-schema.mjs";

function reportVercelParityFailure(detail, env, logger, previewRemediation) {
  if (env.VERCEL_ENV === "production") {
    throw new Error(`[env-parity] ${detail} Refusing to ship a production build without it.`);
  }

  if (env.VERCEL) {
    logger.warn(`[env-parity] ${detail} Staging should mirror production — ${previewRemediation}`);
  }
}

function profileForApp(app) {
  if (app !== "client" && app !== "admin") {
    throw new Error(`Unsupported env-parity app: ${app}`);
  }
  return `production-${app}`;
}

/**
 * Enforce the production schema contract on Vercel builds while keeping local
 * builds non-blocking. The schema is intentionally an optional source during
 * this rollout: a missing/unreadable file warns rather than hiding the build.
 */
export function assertEnvParity({ app, env = process.env, schemaPath, logger = console }) {
  let schema;
  try {
    schema = parseSchema(schemaPath);
  } catch (error) {
    const detail = `Unable to read ${schemaPath}; skipping ${app} schema validation.`;
    if (env.VERCEL_ENV === "production") {
      throw new Error(
        `[env-parity] ${detail} Refusing to ship a production build without schema validation.`,
        { cause: error }
      );
    }

    logger.warn(`[env-parity] ${detail}`);
    return { checked: false, missing: [], empty: [] };
  }
  if (!schema) {
    logger.warn(`[env-parity] Unable to read ${schemaPath}; skipping ${app} schema validation.`);
    return { checked: false, missing: [], empty: [] };
  }

  const profile = profileForApp(app);
  const requiredKeys = requiredKeysForProfile(schema, profile);
  const { missing, empty } = validateRequiredEnvironment(requiredKeys, env);
  if (missing.length === 0 && empty.length === 0) {
    return { checked: true, missing, empty };
  }

  const labels = [
    missing.length > 0 ? `missing: ${missing.sort().join(", ")}` : null,
    empty.length > 0 ? `empty: ${empty.sort().join(", ")}` : null,
  ].filter(Boolean);
  reportVercelParityFailure(
    `${app} ${profile} environment keys are incomplete (${labels.join("; ")}).`,
    env,
    logger,
    "set the required keys for this environment.",
  );

  return { checked: true, missing, empty };
}

/**
 * Sentry aliases are resolved in the Vite configs because each app has its own
 * alias chain. Keep their build-only policy separate from schema annotations.
 */
export function assertSentryDsnResolvable({ app, sentryDsn, env = process.env, logger = console }) {
  if (sentryDsn) return true;

  const appAlias = app === "client" ? "VITE_SENTRY_CLIENT_DSN" : "VITE_SENTRY_ADMIN_DSN";
  reportVercelParityFailure(
    `Sentry DSN did not resolve from any known alias (${appAlias}, VITE_SENTRY_DSN, SENTRY_DSN via the Vercel integration, ...); error tracking would be disabled in this build.`,
    env,
    logger,
    "set the DSN for this environment.",
  );
  return false;
}
