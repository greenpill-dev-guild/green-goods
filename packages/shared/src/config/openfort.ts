/**
 * Email sign-in (Openfort) configuration.
 *
 * The switch is off unless the build sets it, and email sign-in also needs both public keys: a
 * build with the switch on and a key missing shows no email option rather than one that fails.
 * The Shield secret and encryption share live only on the agent. Phone and SMS sign-in come
 * later, with an SMS provider; nothing here reads a switch for them.
 */

import { PUBLIC_AGENT_ROUTES } from "../public-contracts/routes";

export type OpenfortEnv = {
  DEV?: boolean;
  VITE_OPENFORT_SIGN_IN_ENABLED?: string;
  VITE_OPENFORT_PUBLISHABLE_KEY?: string;
  VITE_OPENFORT_SHIELD_PUBLISHABLE_KEY?: string;
  VITE_API_BASE_URL?: string;
};

/** Each key by name: Vite inlines a named key, and pastes the whole env where it is read whole. */
function readOpenfortEnv(): OpenfortEnv {
  return {
    DEV: import.meta.env.DEV,
    VITE_OPENFORT_SIGN_IN_ENABLED: import.meta.env.VITE_OPENFORT_SIGN_IN_ENABLED,
    VITE_OPENFORT_PUBLISHABLE_KEY: import.meta.env.VITE_OPENFORT_PUBLISHABLE_KEY,
    VITE_OPENFORT_SHIELD_PUBLISHABLE_KEY: import.meta.env.VITE_OPENFORT_SHIELD_PUBLISHABLE_KEY,
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  };
}

export interface OpenfortKeys {
  publishableKey: string;
  shieldPublishableKey: string;
}

export function getOpenfortWalletKey(): string | undefined {
  return readOpenfortEnv().VITE_OPENFORT_PUBLISHABLE_KEY?.trim() || undefined;
}

export function getOpenfortKeys(env: OpenfortEnv = readOpenfortEnv()): OpenfortKeys | null {
  const publishableKey = env.VITE_OPENFORT_PUBLISHABLE_KEY?.trim();
  const shieldPublishableKey = env.VITE_OPENFORT_SHIELD_PUBLISHABLE_KEY?.trim();
  return publishableKey && shieldPublishableKey ? { publishableKey, shieldPublishableKey } : null;
}

export function isOpenfortSignInEnabled(env: OpenfortEnv = readOpenfortEnv()): boolean {
  return (
    env.VITE_OPENFORT_SIGN_IN_ENABLED?.trim().toLowerCase() === "true" &&
    Boolean(getOpenfortKeys(env))
  );
}

/** The agent route that mints single-use Shield sessions for automatic recovery. */
export function getOpenfortRecoveryUrl(env: OpenfortEnv = readOpenfortEnv()): string {
  const baseUrl =
    env.VITE_API_BASE_URL?.trim() ||
    (env.DEV ? "http://127.0.0.1:3005" : "https://agent.greengoods.app");
  return `${baseUrl.replace(/\/$/, "")}${PUBLIC_AGENT_ROUTES.openfortRecoverySession}`;
}
