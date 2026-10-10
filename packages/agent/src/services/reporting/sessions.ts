import { type ContinuationRequest, hashSecret, requestById } from "./continuations";
import { inTransaction } from "./database";
import type { ReportingCore } from "./runtime";

/**
 * Short-lived browser access scoped to one resource of one participant. It authorizes API reads
 * and preparation, never chain signing. Every request revalidates expiry, the participant's
 * identity epoch and the account binding, so relinking or revocation ends access even if the
 * browser keeps its cookie. One active session per verified browser; reissuing rotates it.
 */
export interface BrowserSession {
  accessId: string;
  participantId: string;
  accountBindingId: string;
  account: `0x${string}`;
  accountKind: "eoa" | "kernel";
  request: ContinuationRequest;
  identityEpoch: number;
  expiresAt: number;
}

export function issueSession(
  core: ReportingCore,
  challengeId: string
): { session: BrowserSession; sessionToken: string; csrfToken: string } | null {
  return inTransaction(core.db, () => {
    const now = core.clock.now();
    const challenge = core.db
      .query(
        `SELECT c.id, c.request_id, c.verified_account FROM browser_challenges c
         JOIN continuation_requests r ON r.id = c.request_id
         WHERE c.id = $id AND c.state IN ('paired','session_issued') AND r.state = 'open' AND r.expires_at > $now`
      )
      .get({ id: challengeId, now }) as {
      id: string;
      request_id: string;
      verified_account: string;
    } | null;
    const request = challenge ? requestById(core, challenge.request_id) : null;
    if (!challenge || !request?.participantId) return null;
    const account = core.db
      .query(
        `SELECT a.id, a.account_kind, p.identity_epoch FROM account_bindings a JOIN participants p ON p.id = a.participant_id
         WHERE a.participant_id = $participant AND a.account_address = $account AND a.status = 'active'`
      )
      .get({ participant: request.participantId, account: challenge.verified_account }) as {
      id: string;
      account_kind: "eoa" | "kernel";
      identity_epoch: number;
    } | null;
    if (!account || account.identity_epoch !== request.identityEpoch) return null;
    core.db
      .query(
        "UPDATE app_access_grants SET state = 'revoked', revoked_at = $now WHERE browser_challenge_id = $id AND state = 'active'"
      )
      .run({ id: challenge.id, now });
    const accessId = core.ids.id();
    const sessionToken = core.ids.token(32);
    const csrfToken = core.ids.token(24);
    const expiresAt = Math.min(
      now + core.settings.browserSessionTtlMs,
      request.expiresAt + core.settings.browserSessionTtlMs
    );
    core.db
      .query(
        `INSERT INTO app_access_grants
           (id, participant_id, account_binding_id, browser_challenge_id, request_id, resource_kind, resource_id,
            resource_revision, identity_epoch, scope_json, session_token_hash, csrf_token_hash, state, expires_at, created_at)
         VALUES ($id, $participant, $account, $challenge, $request, $kind, $resource, $revision, $epoch, $scope,
                 $session, $csrf, 'active', $expires, $now)`
      )
      .run({
        id: accessId,
        participant: request.participantId,
        account: account.id,
        challenge: challenge.id,
        request: request.id,
        kind: request.resourceKind,
        resource: request.resourceId,
        revision: request.resourceRevision,
        epoch: account.identity_epoch,
        scope: JSON.stringify({ purpose: request.purpose }),
        session: hashSecret(sessionToken),
        csrf: hashSecret(csrfToken),
        expires: expiresAt,
        now,
      });
    core.db
      .query("UPDATE browser_challenges SET state = 'session_issued' WHERE id = $id")
      .run({ id: challenge.id });
    return {
      session: {
        accessId,
        participantId: request.participantId,
        accountBindingId: account.id,
        account: challenge.verified_account as `0x${string}`,
        accountKind: account.account_kind,
        request,
        identityEpoch: account.identity_epoch,
        expiresAt,
      },
      sessionToken,
      csrfToken,
    };
  });
}

/** Resolves a session cookie; mutations also pass the CSRF token bound to that session. */
export function sessionFromToken(
  core: ReportingCore,
  sessionToken: string,
  csrfToken?: string
): BrowserSession | null {
  const row = core.db
    .query(
      `SELECT g.id, g.participant_id, g.account_binding_id, g.request_id, g.identity_epoch, g.expires_at, g.csrf_token_hash,
              a.account_address, a.account_kind, a.status AS account_status, p.identity_epoch AS current_epoch
       FROM app_access_grants g
       JOIN account_bindings a ON a.id = g.account_binding_id
       JOIN participants p ON p.id = g.participant_id
       WHERE g.session_token_hash = $hash AND g.state = 'active' AND g.expires_at > $now`
    )
    .get({ hash: hashSecret(sessionToken), now: core.clock.now() }) as {
    id: string;
    participant_id: string;
    account_binding_id: string;
    request_id: string;
    identity_epoch: number;
    expires_at: number;
    csrf_token_hash: string;
    account_address: `0x${string}`;
    account_kind: "eoa" | "kernel";
    account_status: string;
    current_epoch: number;
  } | null;
  if (!row || row.account_status !== "active" || row.current_epoch !== row.identity_epoch)
    return null;
  if (csrfToken !== undefined && hashSecret(csrfToken) !== row.csrf_token_hash) return null;
  const request = requestById(core, row.request_id);
  if (!request) return null;
  return {
    accessId: row.id,
    participantId: row.participant_id,
    accountBindingId: row.account_binding_id,
    account: row.account_address,
    accountKind: row.account_kind,
    request,
    identityEpoch: row.identity_epoch,
    expiresAt: row.expires_at,
  };
}

export function revokeSession(
  core: ReportingCore,
  accessId: string,
  participantId: string
): boolean {
  return (
    core.db
      .query(
        `UPDATE app_access_grants SET state = 'revoked', revoked_at = $now
         WHERE id = $id AND participant_id = $participant AND state = 'active'`
      )
      .run({ id: accessId, participant: participantId, now: core.clock.now() }).changes === 1
  );
}

/** Ends every browser session of a participant, e.g. when the channel is relinked. */
export function revokeParticipantSessions(core: ReportingCore, participantId: string): number {
  return core.db
    .query(
      "UPDATE app_access_grants SET state = 'revoked', revoked_at = $now WHERE participant_id = $participant AND state = 'active'"
    )
    .run({ participant: participantId, now: core.clock.now() }).changes;
}

/** Issues a fresh CSRF token for a restored session; the old token stops working immediately. */
export function rotateSessionCsrf(core: ReportingCore, accessId: string): string {
  const csrfToken = core.ids.token(24);
  core.db
    .query(
      "UPDATE app_access_grants SET csrf_token_hash = $csrf WHERE id = $id AND state = 'active'"
    )
    .run({ id: accessId, csrf: hashSecret(csrfToken) });
  return csrfToken;
}
