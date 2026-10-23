import type { SessionStorage } from "./session";

// Separate from the legacy boolean sentinel: every logout must change the value,
// even after a wallet login, which intentionally keeps that passkey sentinel.
export const SIGN_OUT_REVISION_KEY = "greengoods_sign_out_revision";

const actorRevisions = new WeakMap<object, { current: string | null }>();

/** Keep logout acknowledgement with the actor, across provider mounts. */
export function getActorSignOutRevision(actor: object, initial = getSignOutRevision()) {
  let revision = actorRevisions.get(actor);
  if (!revision) {
    revision = { current: initial };
    actorRevisions.set(actor, revision);
  }
  return revision;
}

export function getSignOutRevision(storage: SessionStorage = localStorage): string | null {
  return storage.getItem(SIGN_OUT_REVISION_KEY);
}

export function publishSignOut(storage: SessionStorage = localStorage): string {
  const revision = crypto.randomUUID();
  storage.setItem(SIGN_OUT_REVISION_KEY, revision);
  return revision;
}

/** An abandoned ceremony must never cache a session or clear the logout sentinel. */
export function guardSessionCommit(signal: AbortSignal): () => void {
  const revision = getSignOutRevision();
  return () => {
    if (signal.aborted || getSignOutRevision() !== revision) {
      throw new DOMException("Session ended during authentication", "AbortError");
    }
  };
}
