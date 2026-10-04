import {
  buildReportSummary,
  reportSummaryDigest,
} from "@green-goods/shared/modules/agent-reporting";
import { pairFromChat } from "../channel-pairing";
import { issueContinuation } from "../continuations";
import { commitDraft } from "../drafts";
import { enqueueJob } from "../jobs";
import { conversationRealm } from "../notify";
import { upsertOperation } from "../operations";
import { activeAccount, bindingForSubject } from "../participants";
import { resolvePrompt } from "../prompts";
import { commitLifecycle, lifecycleState } from "./draft-commit";
import { recordDraftConfirmation } from "./report-commands";
import type { TurnWriter } from "./writer";

/**
 * Linking and publication consent in chat. Pairing completes only when the code shown in the
 * verifying browser arrives from this chat. A confirmation made before the account was linked is
 * replaced by a new one that names the account, recorded with publication consent for that digest.
 */
export function handlePairing(writer: TurnWriter, code: string): void {
  const { core, ctx } = writer;
  if (!ctx.binding) return writer.say("link.pairFailed");
  const result = pairFromChat(core, ctx.subjectId, ctx.binding.participantId, code);
  if (result.status === "no_match") return writer.say("link.pairFailed");
  if (result.status === "account_taken") return writer.say("link.accountTaken");
  ctx.binding = bindingForSubject(core, ctx.subjectId);
  if (!ctx.binding) throw new Error("Paired channel binding is missing");
  ctx.account = activeAccount(core, ctx.binding.participantId, core.settings.chainId);
  ctx.locale = ctx.binding.locale ?? ctx.locale;
  if (ctx.draft) ctx.draft = { ...ctx.draft, participantId: ctx.binding.participantId };
  writer.say("link.paired", { account: result.account });
  const draft = ctx.draft;
  if (draft && lifecycleState(draft) === "authority") {
    enqueueJob(core, {
      kind: "resolve_authority",
      subjectId: draft.id,
      dedupeKey: `authority:${draft.id}:paired:${result.accountBindingId}`,
    });
  }
}

export function confirmPublication(
  writer: TurnWriter,
  token: string | null,
  fromButton: boolean
): void {
  const { core, ctx } = writer;
  const draft = ctx.draft;
  const prompt = ctx.prompt;
  const account = ctx.account;
  if (!draft || !account || lifecycleState(draft) !== "authority")
    return writer.say("report.noStatus");
  if (
    prompt?.kind !== "publication_consent" ||
    prompt.subjectId !== draft.id ||
    prompt.subjectRevision !== draft.revision
  ) {
    return writer.say("report.noStatus");
  }
  if (!fromButton && token !== prompt.token)
    return writer.say("report.confirmToken", { token: prompt.token });
  const summary = buildReportSummary({
    draftId: draft.id,
    revision: draft.revision,
    content: draft.content,
    snapshot: draft.snapshot,
    account: account.address as `0x${string}`,
  });
  const committed = commitDraft(core, {
    draftId: draft.id,
    expectedRevision: draft.revision,
    lifecycle: draft.lifecycle,
    participantAction: true,
    authorAccountId: account.id,
  });
  if (committed === "stale") return writer.say("report.noStatus");
  recordDraftConfirmation(writer, draft, reportSummaryDigest(summary), prompt.id, account.id);
  resolvePrompt(core, prompt.id);
}

/** A Kernel owner chooses a bounded reporting grant or exact signing for this report only. */
export function answerGrantChoice(writer: TurnWriter, choice: string): void {
  const { core, ctx } = writer;
  const draft = ctx.draft;
  const account = ctx.account;
  const binding = ctx.binding;
  if (
    !draft ||
    !account ||
    !binding ||
    lifecycleState(draft) !== "grantChoice" ||
    !draft.content.garden
  ) {
    return writer.say("report.noStatus");
  }
  if (ctx.prompt) resolvePrompt(core, ctx.prompt.id);
  if (choice === "once") {
    const { draft: preparing } = commitLifecycle(core, draft, [{ type: "SIGN_ONCE_CHOSEN" }], {
      participantAction: true,
    });
    const confirmation = core.db
      .query("SELECT id FROM confirmations WHERE draft_id = $id AND invalidated_at IS NULL")
      .get({ id: draft.id }) as { id: string } | null;
    if (!confirmation) return writer.say("report.noStatus");
    const operation = upsertOperation(core, {
      subject: { draftId: draft.id },
      authorAccountId: account.id,
      revision: preparing.revision,
      confirmationId: confirmation.id,
      chainId: draft.content.garden.chainId,
      gardenAddress: draft.content.garden.address,
      mode: "owner",
    });
    if (typeof operation === "string") return writer.say("report.frozen");
    enqueueJob(core, {
      kind: "prepare_operation",
      subjectId: draft.id,
      dedupeKey: `prepare:${operation.id}:${operation.version}`,
    });
    return writer.say("publish.sending");
  }
  const { url } = issueContinuation(core, {
    purpose: "grant_reporting",
    participantId: binding.participantId,
    subjectId: ctx.subjectId,
    bindingId: binding.bindingId,
    conversationId: ctx.conversationId,
    providerRealm: conversationRealm(core, ctx.conversationId),
    resourceKind: "grant",
    resourceId: draft.id,
    resourceRevision: draft.revision,
    resourceDigest: `garden:${draft.content.garden.address}`,
    expectedAccount: account.address,
    identityEpoch: binding.identityEpoch,
  });
  writer.say(
    "publish.signLink",
    { kind: writer.text("account.passkey") },
    { url, label: writer.text("publish.allowReporting") }
  );
}
