import {
  type ContinuationRequest,
  completeRequest,
  hashSecret,
  requestById,
} from "./continuations";
import { activeAccount, attachProvisionalChannel } from "./participants";
import type { ReportingCore } from "./runtime";

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
       JOIN channel_bindings b ON b.id = r.channel_binding_id
       JOIN participants p ON p.id = b.participant_id
       WHERE r.channel_subject_id = $subject AND r.state = 'open' AND c.state = 'proof_verified'
         AND r.purpose IN ('link_account','publish_work','review_decision')
         AND r.participant_id = $participant AND b.participant_id = $participant
         AND b.channel_subject_id = r.channel_subject_id
         AND b.status IN ('provisional','active') AND b.identity_epoch = r.identity_epoch
         AND p.identity_epoch = r.identity_epoch
         AND c.expires_at > $now AND c.pairing_attempts < $max`
    )
    .all({
      subject: subjectId,
      participant: participantId,
      now,
      max: MAX_PAIRING_ATTEMPTS,
    }) as Array<{
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
  const currentAccount = activeAccount(core, participantId, core.settings.chainId);
  if (currentAccount && currentAccount.address !== match.verified_account)
    return { status: "account_taken" };
  if (taken && taken.participant_id !== participantId) {
    if (
      !attachProvisionalChannel(core, {
        participantId,
        canonicalParticipantId: taken.participant_id,
        subjectId,
        requestId: match.request_id,
      })
    )
      return { status: "account_taken" };
    participantId = taken.participant_id;
  }
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
