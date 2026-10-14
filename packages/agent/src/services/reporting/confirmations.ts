import type { ReportingCore } from "./runtime";

/**
 * Durable record of what a participant explicitly confirmed. `confirmed_at` alone is not
 * authority: the record binds the exact summary digest, revision, Action definition, account,
 * garden, source event, prompt and identity epoch, and publication requires it to be current.
 */
export interface ConfirmationRecord {
  id: string;
  subjectId: string;
  revision: number;
  summaryDigest: string;
  contentDigest: string;
  actionDefinitionDigest: string | null;
  accountBindingId: string | null;
  gardenChainId: number;
  gardenAddress: string;
  identityEpoch: number;
  publicationConsentId: string | null;
}

interface ConfirmationRow {
  id: string;
  draft_id: string | null;
  review_intent_id: string | null;
  revision: number;
  summary_digest: string;
  content_digest: string;
  action_definition_digest: string | null;
  account_binding_id: string | null;
  garden_chain_id: number;
  garden_address: string;
  identity_epoch: number;
  publication_consent_id: string | null;
}

function toRecord(row: ConfirmationRow | null): ConfirmationRecord | null {
  return row
    ? {
        id: row.id,
        subjectId: (row.draft_id ?? row.review_intent_id) as string,
        revision: row.revision,
        summaryDigest: row.summary_digest,
        contentDigest: row.content_digest,
        actionDefinitionDigest: row.action_definition_digest,
        accountBindingId: row.account_binding_id,
        gardenChainId: row.garden_chain_id,
        gardenAddress: row.garden_address,
        identityEpoch: row.identity_epoch,
        publicationConsentId: row.publication_consent_id,
      }
    : null;
}

export function recordConfirmation(
  core: ReportingCore,
  input: {
    subject: { draftId: string } | { reviewIntentId: string };
    revision: number;
    summaryDigest: string;
    contentDigest: string;
    actionDefinitionDigest: string | null;
    accountBindingId: string | null;
    gardenChainId: number;
    gardenAddress: string;
    sourceEventId: string;
    promptId: string;
    identityEpoch: number;
    publicationConsentId: string | null;
  }
): string {
  const draftId = "draftId" in input.subject ? input.subject.draftId : null;
  const reviewIntentId = "reviewIntentId" in input.subject ? input.subject.reviewIntentId : null;
  invalidateConfirmation(core, input.subject);
  const id = core.ids.id();
  core.db
    .query(
      `INSERT INTO confirmations
         (id, draft_id, review_intent_id, revision, summary_digest, content_digest, action_definition_digest,
          account_binding_id, garden_chain_id, garden_address, source_event_id, prompt_id, identity_epoch,
          publication_consent_id, confirmed_at)
       VALUES ($id, $draft, $review, $revision, $summary, $content, $action, $account, $chain, $garden,
               $source, $prompt, $epoch, $consent, $now)`
    )
    .run({
      id,
      draft: draftId,
      review: reviewIntentId,
      revision: input.revision,
      summary: input.summaryDigest,
      content: input.contentDigest,
      action: input.actionDefinitionDigest,
      account: input.accountBindingId,
      chain: input.gardenChainId,
      garden: input.gardenAddress,
      source: input.sourceEventId,
      prompt: input.promptId,
      epoch: input.identityEpoch,
      consent: input.publicationConsentId,
      now: core.clock.now(),
    });
  return id;
}

export function invalidateConfirmation(
  core: ReportingCore,
  subject: { draftId: string } | { reviewIntentId: string }
): void {
  const column = "draftId" in subject ? "draft_id" : "review_intent_id";
  const id = "draftId" in subject ? subject.draftId : subject.reviewIntentId;
  core.db
    .query(
      `UPDATE confirmations SET invalidated_at = $now WHERE ${column} = $id AND invalidated_at IS NULL`
    )
    .run({ id, now: core.clock.now() });
}

export function currentConfirmation(
  core: ReportingCore,
  subject: { draftId: string } | { reviewIntentId: string }
): ConfirmationRecord | null {
  const column = "draftId" in subject ? "draft_id" : "review_intent_id";
  const id = "draftId" in subject ? subject.draftId : subject.reviewIntentId;
  return toRecord(
    core.db
      .query(`SELECT * FROM confirmations WHERE ${column} = $id AND invalidated_at IS NULL`)
      .get({ id }) as ConfirmationRow | null
  );
}

export function confirmationById(core: ReportingCore, id: string): ConfirmationRecord | null {
  return toRecord(
    core.db
      .query("SELECT * FROM confirmations WHERE id = $id")
      .get({ id }) as ConfirmationRow | null
  );
}
