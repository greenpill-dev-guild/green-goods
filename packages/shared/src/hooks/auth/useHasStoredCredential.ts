import { useCallback, useSyncExternalStore } from "react";
import { hasStoredCredential } from "../../modules/auth/session";

/** What this hook needs of the auth actor: to hear that the session changed. */
interface SessionChanges {
  subscribe(listener: () => void): { unsubscribe(): void };
}

function noCredentialOnTheServer(): boolean {
  return false;
}

/**
 * Whether this device remembers a passkey account, read from storage again each time the session
 * changes: creating an account or signing in by name saves one, and nothing else tells the page.
 *
 * It is a subscription, not a value computed while rendering. A storage read names no reactive
 * value, so the React Compiler, which the app builds run and the tests do not, keeps the first
 * answer for the life of the page. The sign-in screens would go on treating someone who made an
 * account a minute ago and signed out as a newcomer, and offer them a second account.
 */
export function useHasStoredCredential(session: SessionChanges | null): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!session) return () => {};
      const subscription = session.subscribe(onChange);
      return () => subscription.unsubscribe();
    },
    [session]
  );
  return useSyncExternalStore(
    subscribe,
    // Called bare, so the read never takes an argument React might one day pass.
    () => hasStoredCredential(),
    noCredentialOnTheServer
  );
}
