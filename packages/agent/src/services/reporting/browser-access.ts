import {
  buildReportingProofMessage,
  type ReportingProofFields,
} from "@green-goods/shared/modules/agent-reporting";
import type { AccountKind, Addr, ReportingChain } from "./chain";
import { type ContinuationRequest, hashSecret, requestById } from "./continuations";
import { inTransaction } from "./database";
import { activeAccount } from "./participants";
import { verifyRecoveryProof } from "./recovery";
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
  request: ContinuationRequest,
  recognized: { address: string; kind: AccountKind } | null = null
): { challenge: BrowserChallenge; preauthToken: string; csrfToken: string } {
  const id = core.ids.id();
  const preauthToken = core.ids.token(32);
  const csrfToken = core.ids.token(24);
  const nonce = core.ids.token(16);
  core.db
    .query(
      `INSERT INTO browser_challenges
         (id, request_id, preauth_token_hash, csrf_token_hash, browser_nonce, state,
          verified_account, verified_account_kind, verified_at, paired_at, created_at, expires_at)
       VALUES ($id, $request, $preauth, $csrf, $nonce, $state,
               $account, $kind, $verified, $paired, $now, $expires)`
    )
    .run({
      id,
      request: request.id,
      preauth: hashSecret(preauthToken),
      csrf: hashSecret(csrfToken),
      nonce,
      state: recognized ? "paired" : "issued",
      account: recognized?.address ?? null,
      kind: recognized?.kind ?? null,
      verified: recognized ? core.clock.now() : null,
      paired: recognized ? core.clock.now() : null,
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
    if (request.purpose === "recovery") {
      return verifyRecoveryProof(core, request, challenge, { account, kind });
    }
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
