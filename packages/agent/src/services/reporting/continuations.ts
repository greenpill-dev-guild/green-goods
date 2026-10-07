import { createHash } from "node:crypto";
import type { ReportingPurpose } from "@green-goods/shared/modules/agent-reporting";
import type { ReportingCore } from "./runtime";

/**
 * Browser continuation requests. A locator in `/agent/reporting/:requestId` is an opaque,
 * high-entropy reference to one purpose and one resource for one chat source; it is never a
 * credential. Only its hash is stored, a GET of the page never consumes it, and issuing a new
 * link for the same resource and purpose retires the previous one.
 */
export interface ContinuationRequest {
  id: string;
  purpose: ReportingPurpose;
  participantId: string | null;
  subjectId: string;
  bindingId: string | null;
  conversationId: string;
  providerRealm: string;
  resourceKind: "draft" | "review" | "grant" | "recovery" | "account";
  resourceId: string | null;
  resourceRevision: number | null;
  resourceDigest: string;
  expectedAccount: string | null;
  identityEpoch: number;
  expiresAt: number;
}

interface RequestRow {
  id: string;
  purpose: ReportingPurpose;
  participant_id: string | null;
  channel_subject_id: string;
  channel_binding_id: string | null;
  conversation_id: string;
  provider_realm: string;
  resource_kind: ContinuationRequest["resourceKind"];
  resource_id: string | null;
  resource_revision: number | null;
  resource_digest: string;
  expected_account: string | null;
  identity_epoch: number;
  expires_at: number;
}

export function hashSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function toRequest(row: RequestRow | null): ContinuationRequest | null {
  return row
    ? {
        id: row.id,
        purpose: row.purpose,
        participantId: row.participant_id,
        subjectId: row.channel_subject_id,
        bindingId: row.channel_binding_id,
        conversationId: row.conversation_id,
        providerRealm: row.provider_realm,
        resourceKind: row.resource_kind,
        resourceId: row.resource_id,
        resourceRevision: row.resource_revision,
        resourceDigest: row.resource_digest,
        expectedAccount: row.expected_account,
        identityEpoch: row.identity_epoch,
        expiresAt: row.expires_at,
      }
    : null;
}

/** Presentation label for the originating chat; an allowlist, never a query parameter. */
export function channelLabel(providerRealm: string): string {
  const platform = providerRealm.split(":")[0] ?? "";
  if (platform === "whatsapp" || platform === "whatsapp-fixture") return "WhatsApp";
  if (platform === "telegram" || platform === "telegram-fixture") return "Telegram";
  return "Chat";
}

export function issueContinuation(
  core: ReportingCore,
  input: Omit<ContinuationRequest, "id" | "expiresAt"> & { ttlMs?: number }
): { request: ContinuationRequest; url: string } {
  const now = core.clock.now();
  core.db
    .query(
      `UPDATE continuation_requests SET state = 'revoked'
       WHERE state = 'open' AND purpose = $purpose AND resource_kind = $kind
         AND COALESCE(resource_id, '') = COALESCE($resource, '') AND channel_subject_id = $subject`
    )
    .run({
      purpose: input.purpose,
      kind: input.resourceKind,
      resource: input.resourceId,
      subject: input.subjectId,
    });
  const id = core.ids.id();
  const locator = core.ids.token(24);
  const expiresAt = now + (input.ttlMs ?? core.settings.linkChallengeTtlMs);
  core.db
    .query(
      `INSERT INTO continuation_requests
         (id, locator_hash, purpose, participant_id, channel_subject_id, channel_binding_id, conversation_id,
          provider_realm, resource_kind, resource_id, resource_revision, resource_digest, expected_account,
          identity_epoch, state, created_at, expires_at)
       VALUES ($id, $hash, $purpose, $participant, $subject, $binding, $conversation, $realm, $kind, $resource,
               $revision, $digest, $account, $epoch, 'open', $now, $expires)`
    )
    .run({
      id,
      hash: hashSecret(locator),
      purpose: input.purpose,
      participant: input.participantId,
      subject: input.subjectId,
      binding: input.bindingId,
      conversation: input.conversationId,
      realm: input.providerRealm,
      kind: input.resourceKind,
      resource: input.resourceId,
      revision: input.resourceRevision,
      digest: input.resourceDigest,
      account: input.expectedAccount?.toLowerCase() ?? null,
      epoch: input.identityEpoch,
      now,
      expires: expiresAt,
    });
  const path = input.purpose === "recovery" ? "/agent/reporting/recover/" : "/agent/reporting/";
  return {
    request: {
      ...input,
      id,
      expiresAt,
      expectedAccount: input.expectedAccount?.toLowerCase() ?? null,
    },
    url: `${core.settings.browserOrigin}${path}${locator}`,
  };
}

export function openRequestByLocator(
  core: ReportingCore,
  locator: string
): ContinuationRequest | null {
  return toRequest(
    core.db
      .query(
        "SELECT * FROM continuation_requests WHERE locator_hash = $hash AND state = 'open' AND expires_at > $now"
      )
      .get({ hash: hashSecret(locator), now: core.clock.now() }) as RequestRow | null
  );
}

export function requestById(core: ReportingCore, id: string): ContinuationRequest | null {
  return toRequest(
    core.db
      .query("SELECT * FROM continuation_requests WHERE id = $id")
      .get({ id }) as RequestRow | null
  );
}

export function completeRequest(core: ReportingCore, requestId: string): void {
  core.db
    .query(
      "UPDATE continuation_requests SET state = 'completed', completed_at = $now WHERE id = $id AND state = 'open'"
    )
    .run({ id: requestId, now: core.clock.now() });
}
