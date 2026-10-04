import { hashSecret, type ContinuationRequest } from "./continuations";
import type { ReportingCore } from "./runtime";

/** A short browser-only proof memory. The bearer value stays in an HttpOnly cookie; the database
 * keeps only its digest and checks the live chat binding again for every new link. */
export const RECOGNITION_TTL_MS = 15 * 60_000;

export interface RecognizedAccount {
  address: string;
  kind: "eoa" | "kernel";
}

export function recognizedAccount(
  core: ReportingCore,
  token: string,
  request: ContinuationRequest
): RecognizedAccount | null {
  if (!request.participantId || !request.bindingId || request.purpose === "recovery") return null;
  const row = core.db
    .query(
      `SELECT a.account_address, a.account_kind FROM browser_recognitions m
     JOIN participants p ON p.id = m.participant_id
     JOIN channel_bindings b ON b.id = $binding
     JOIN account_bindings a ON a.participant_id = p.id AND a.chain_id = $chain
     WHERE m.token_hash = $token AND m.participant_id = $participant
       AND m.identity_epoch = $epoch AND p.identity_epoch = m.identity_epoch
       AND m.account_address = a.account_address AND a.status = 'active'
       AND b.participant_id = p.id AND b.channel_subject_id = $subject
       AND b.identity_epoch = p.identity_epoch AND b.status = 'active'
       AND m.expires_at > $now`
    )
    .get({
      token: hashSecret(token),
      participant: request.participantId,
      binding: request.bindingId,
      subject: request.subjectId,
      chain: core.settings.chainId,
      epoch: request.identityEpoch,
      now: core.clock.now(),
    }) as { account_address: string; account_kind: "eoa" | "kernel" } | null;
  if (!row || (request.expectedAccount && request.expectedAccount !== row.account_address))
    return null;
  return { address: row.account_address, kind: row.account_kind };
}

/** Called only after this browser's challenge was seen paired with its proven account. */
export function issueRecognition(
  core: ReportingCore,
  participantId: string,
  account: string,
  identityEpoch: number
): string {
  const token = core.ids.token(32);
  const now = core.clock.now();
  core.db
    .query(
      `INSERT INTO browser_recognitions
       (token_hash, participant_id, account_address, identity_epoch, expires_at, created_at)
     VALUES ($token, $participant, $account, $epoch, $expires, $now)`
    )
    .run({
      token: hashSecret(token),
      participant: participantId,
      account,
      epoch: identityEpoch,
      expires: now + RECOGNITION_TTL_MS,
      now,
    });
  return token;
}

export function endRecognition(core: ReportingCore, participantId: string): void {
  core.db
    .query("DELETE FROM browser_recognitions WHERE participant_id = $participant")
    .run({ participant: participantId });
}
