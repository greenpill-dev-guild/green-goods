import {
  buildReportingProofMessage,
  type ReportingProofFields,
} from "@green-goods/shared/modules/agent-reporting";
import type { AccountKind, Addr, ReportingChain } from "./chain";
import {
  type ContinuationRequest,
  completeRequest,
  hashSecret,
  requestById,
} from "./continuations";
import { inTransaction } from "./database";
import { activeAccount } from "./participants";
import type { ReportingCore } from "./runtime";

/**
 * Browser challenges and scoped sessions. Each browser that opens a link gets its own challenge,
 * pre-authentication cookie and CSRF token, so an unverified opener can never lock out the owner.
 * Proof is verified against the Agent's own record; pairing needs the code shown in that browser
 * to arrive from the original chat. Sessions are hashed, scoped to one resource and one browser.
 */
export type AccountProofVerifier = (input: {
  chainId: number;
  address: Addr;
  message: string;
  signature: `0x${string}`;
  factory?: Addr;
  factoryData?: `0x${string}`;
}) => Promise<boolean>;

export type ChallengeState =
  | "issued"
  | "proof_verified"
  | "paired"
  | "session_issued"
  | "superseded"
  | "expired"
  | "rejected";

export interface BrowserChallenge {
  id: string;
  requestId: string;
  state: ChallengeState;
  browserNonce: string;
  verifiedAccount: string | null;
  verifiedAccountKind: "eoa" | "kernel" | null;
  pairingCode: string | null;
  createdAt: number;
  expiresAt: number;
}

interface ChallengeRow {
  id: string;
  request_id: string;
  state: ChallengeState;
  browser_nonce: string;
  verified_account: string | null;
  verified_account_kind: "eoa" | "kernel" | null;
  created_at: number;
  expires_at: number;
}

function toChallenge(
  row: ChallengeRow | null,
  pairingCode: string | null = null
): BrowserChallenge | null {
  return row
    ? {
        id: row.id,
        requestId: row.request_id,
        state: row.state,
        browserNonce: row.browser_nonce,
        verifiedAccount: row.verified_account,
        verifiedAccountKind: row.verified_account_kind,
        pairingCode,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      }
    : null;
}

export function createBrowserChallenge(
  core: ReportingCore,
  request: ContinuationRequest
): { challenge: BrowserChallenge; preauthToken: string; csrfToken: string } {
  const id = core.ids.id();
  const preauthToken = core.ids.token(32);
  const csrfToken = core.ids.token(24);
  const nonce = core.ids.token(16);
  core.db
    .query(
      `INSERT INTO browser_challenges
         (id, request_id, preauth_token_hash, csrf_token_hash, browser_nonce, state, created_at, expires_at)
       VALUES ($id, $request, $preauth, $csrf, $nonce, 'issued', $now, $expires)`
    )
    .run({
      id,
      request: request.id,
      preauth: hashSecret(preauthToken),
      csrf: hashSecret(csrfToken),
      nonce,
      now: core.clock.now(),
      expires: request.expiresAt,
    });
  return { challenge: challengeById(core, id) as BrowserChallenge, preauthToken, csrfToken };
}

export function challengeById(core: ReportingCore, id: string): BrowserChallenge | null {
  return toChallenge(
    core.db
      .query("SELECT * FROM browser_challenges WHERE id = $id")
      .get({ id }) as ChallengeRow | null
  );
}

/** The caller's own challenge, authenticated by its pre-authentication cookie and CSRF token. */
export function challengeForBrowser(
  core: ReportingCore,
  challengeId: string,
  preauthToken: string,
  csrfToken?: string
): BrowserChallenge | null {
  const row = core.db
    .query(
      "SELECT * FROM browser_challenges WHERE id = $id AND preauth_token_hash = $preauth AND expires_at > $now"
    )
    .get({ id: challengeId, preauth: hashSecret(preauthToken), now: core.clock.now() }) as
    | (ChallengeRow & { csrf_token_hash: string })
    | null;
  if (!row) return null;
  if (csrfToken !== undefined && row.csrf_token_hash !== hashSecret(csrfToken)) return null;
  return toChallenge(row);
}

/** The pairing code for the caller's own challenge, so a refreshed page can show it again. */
export function ownPairingCode(core: ReportingCore, challenge: BrowserChallenge): string | null {
  if (challenge.state !== "proof_verified") return null;
  const row = core.db
    .query("SELECT pairing_code_ciphertext FROM browser_challenges WHERE id = $id")
    .get({ id: challenge.id }) as { pairing_code_ciphertext: string | null } | null;
  return row?.pairing_code_ciphertext
    ? core.keyring.open(row.pairing_code_ciphertext, `browser_challenges.pairing:${challenge.id}`)
    : null;
}

export function proofFields(
  core: ReportingCore,
  request: ContinuationRequest,
  challenge: BrowserChallenge
): ReportingProofFields {
  return {
    purpose: request.purpose,
    challengeId: challenge.id,
    browserNonce: challenge.browserNonce,
    origin: core.settings.browserOrigin,
    chainId: core.settings.chainId,
    providerRealm: request.providerRealm,
    source:
      request.bindingId ??
      `subject:${hashSecret(`${request.providerRealm}:${request.subjectId}`).slice(0, 32)}`,
    resourceDigest: request.resourceDigest,
    identityEpoch: request.identityEpoch,
    issuedAt: new Date(challenge.createdAt).toISOString(),
    expiresAt: new Date(challenge.expiresAt).toISOString(),
  };
}

export type ProofResult =
  | { ok: true; state: ChallengeState; pairingCode?: string }
  | {
      ok: false;
      errorCode: "forbidden" | "conflict" | "dependency_unavailable" | "unsupported_scope";
    };

/** Verifies account control for one challenge. External calls happen before the atomic consume. */
export async function verifyChallengeProof(
  core: ReportingCore,
  deps: { verifier: AccountProofVerifier; chain: ReportingChain },
  challenge: BrowserChallenge,
  proof: { account: Addr; signature: `0x${string}`; factory?: Addr; factoryData?: `0x${string}` }
): Promise<ProofResult> {
  const request = requestById(core, challenge.requestId);
  if (!request || challenge.state !== "issued") return { ok: false, errorCode: "conflict" };
  const account = proof.account.toLowerCase() as Addr;
  if (request.expectedAccount && request.expectedAccount !== account)
    return { ok: false, errorCode: "forbidden" };
  const message = buildReportingProofMessage(proofFields(core, request, challenge), account);
  let valid: boolean;
  let kind: AccountKind;
  try {
    valid = await deps.verifier({
      chainId: core.settings.chainId,
      address: account,
      message,
      signature: proof.signature,
      ...(proof.factory ? { factory: proof.factory } : {}),
      ...(proof.factoryData ? { factoryData: proof.factoryData } : {}),
    });
    kind = valid
      ? await deps.chain.accountKind(
          core.settings.chainId,
          account,
          proof.factory,
          proof.factoryData
        )
      : "unsupported";
  } catch {
    return { ok: false, errorCode: "dependency_unavailable" };
  }
  if (!valid) return { ok: false, errorCode: "forbidden" };
  if (kind === "unsupported") return { ok: false, errorCode: "unsupported_scope" };

  return inTransaction(core.db, (): ProofResult => {
    const bound = request.participantId
      ? activeAccount(core, request.participantId, core.settings.chainId)
      : null;
    if (bound && bound.address !== account) return { ok: false, errorCode: "forbidden" };
    const pairingCode = bound ? null : core.ids.code(6);
    const next: ChallengeState = bound ? "paired" : "proof_verified";
    const consumed = core.db
      .query(
        `UPDATE browser_challenges
         SET state = $next, verified_account = $account, verified_account_kind = $kind, pairing_code_hash = $code,
             pairing_code_ciphertext = $sealedCode,
             verified_at = $now, paired_at = CASE WHEN $next = 'paired' THEN $now ELSE NULL END
         WHERE id = $id AND state = 'issued' AND expires_at > $now`
      )
      .run({
        id: challenge.id,
        next,
        account,
        kind,
        code: pairingCode ? hashSecret(pairingCode) : null,
        sealedCode: pairingCode
          ? core.keyring.seal(pairingCode, `browser_challenges.pairing:${challenge.id}`)
          : null,
        now: core.clock.now(),
      });
    if (consumed.changes !== 1) return { ok: false, errorCode: "conflict" };
    return pairingCode ? { ok: true, state: next, pairingCode } : { ok: true, state: next };
  });
}

const MAX_PAIRING_ATTEMPTS = 5;

export type PairingResult =
  | { status: "paired"; request: ContinuationRequest; accountBindingId: string; account: string }
  | { status: "no_match" }
  | { status: "account_taken" };

/**
 * The chat half of pairing: the code shown in the verifying browser must arrive from the chat that
 * requested the link. Runs inside the turn's transaction. A successful pairing activates the
 * binding, records the proven account and retires competing browser candidates.
 */
export function pairFromChat(
  core: ReportingCore,
  subjectId: string,
  participantId: string,
  code: string
): PairingResult {
  const now = core.clock.now();
  const candidates = core.db
    .query(
      `SELECT c.id, c.request_id, c.verified_account, c.verified_account_kind, c.pairing_code_hash
       FROM browser_challenges c JOIN continuation_requests r ON r.id = c.request_id
       WHERE r.channel_subject_id = $subject AND r.state = 'open' AND c.state = 'proof_verified'
         AND c.expires_at > $now AND c.pairing_attempts < $max`
    )
    .all({ subject: subjectId, now, max: MAX_PAIRING_ATTEMPTS }) as Array<{
    id: string;
    request_id: string;
    verified_account: string;
    verified_account_kind: "eoa" | "kernel";
    pairing_code_hash: string;
  }>;
  const match = candidates.find((candidate) => candidate.pairing_code_hash === hashSecret(code));
  if (!match) {
    for (const candidate of candidates) {
      core.db
        .query(
          "UPDATE browser_challenges SET pairing_attempts = pairing_attempts + 1 WHERE id = $id"
        )
        .run({ id: candidate.id });
    }
    return { status: "no_match" };
  }
  const taken = core.db
    .query(
      `SELECT participant_id FROM account_bindings
       WHERE chain_id = $chain AND account_address = $account AND status = 'active'`
    )
    .get({ chain: core.settings.chainId, account: match.verified_account }) as {
    participant_id: string;
  } | null;
  if (taken && taken.participant_id !== participantId) return { status: "account_taken" };
  let accountBindingId = activeAccount(core, participantId, core.settings.chainId)?.id ?? null;
  if (!accountBindingId) {
    accountBindingId = core.ids.id();
    core.db
      .query(
        `INSERT INTO account_bindings (id, participant_id, chain_id, account_address, account_kind, status, verified_at, created_at)
         VALUES ($id, $participant, $chain, $account, $kind, 'active', $now, $now)`
      )
      .run({
        id: accountBindingId,
        participant: participantId,
        chain: core.settings.chainId,
        account: match.verified_account,
        kind: match.verified_account_kind,
        now,
      });
  }
  core.db
    .query("UPDATE browser_challenges SET state = 'paired', paired_at = $now WHERE id = $id")
    .run({ id: match.id, now });
  core.db
    .query(
      "UPDATE browser_challenges SET state = 'superseded' WHERE request_id = $request AND id <> $id AND state IN ('issued','proof_verified')"
    )
    .run({ request: match.request_id, id: match.id });
  completeRequest(core, match.request_id);
  core.db
    .query(
      "UPDATE channel_bindings SET status = 'active', verified_at = $now WHERE channel_subject_id = $subject AND status = 'provisional'"
    )
    .run({ subject: subjectId, now });
  core.db
    .query(
      "UPDATE participants SET status = 'active', updated_at = $now WHERE id = $id AND status = 'provisional'"
    )
    .run({ id: participantId, now });
  return {
    status: "paired",
    request: requestById(core, match.request_id) as ContinuationRequest,
    accountBindingId,
    account: match.verified_account,
  };
}
