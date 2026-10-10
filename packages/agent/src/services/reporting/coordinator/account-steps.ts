import {
  buildReportSummary,
  reportSummaryDigest,
} from "@green-goods/shared/modules/agent-reporting";
import type { Address } from "@green-goods/shared/types/domain";
import { pairFromChat } from "../channel-pairing";
import { issueContinuation } from "../continuations";
import { commitDraft, type DraftRecord } from "../drafts";
import { gardenScope, type ReportingGarden } from "../gardens";
import { enqueueJob } from "../jobs";
import { conversationRealm } from "../notify";
import { upsertOperation } from "../operations";
import { activeAccount, audit, bindingForSubject } from "../participants";
import { closeConversationPrompt, resolvePrompt } from "../prompts";
import { endRecognition } from "../recognition";
import { revokeParticipantSessions } from "../sessions";
import { accountLink } from "./account-link";
import { commitLifecycle, lifecycleState } from "./draft-commit";
import { askGarden } from "./garden-step";
import { askConfirmation } from "./prompting";
import { recordDraftConfirmation } from "./report-commands";
import {
  apply,
  finish,
  gardenerFact,
  gardenToDrop,
  type TurnExternal,
  type Working,
} from "./report-work";
import type { TurnWriter } from "./writer";

/** How many garden names a reply lists before it counts the rest. */
const NAMED_GARDENS = 5;

function gardenNames(writer: TurnWriter, gardens: readonly ReportingGarden[]): string {
  const named = gardens
    .slice(0, NAMED_GARDENS)
    .map((garden) => garden.label)
    .join(", ");
  return gardens.length > NAMED_GARDENS
    ? writer.text("link.gardensMore", { gardens: named, count: gardens.length - NAMED_GARDENS })
    : named;
}

/** The sentence a linked chat gets about its account's gardens. */
function linkedGardens(writer: TurnWriter, account: Address): string {
  const memberships = writer.core.gardens.membershipsOf(account);
  if (!memberships.ok) return writer.text("link.gardensUnknown");
  return memberships.gardens.length > 0
    ? writer.text("link.gardens", { gardens: gardenNames(writer, memberships.gardens) })
    : writer.text("link.noGardens");
}

/**
 * A hello, or `START` from an idle chat. A chat with no account is offered the link first; a
 * linked one is told which account it reports as. Neither starts a report.
 */
export function welcome(writer: TurnWriter): void {
  const account = writer.ctx.account?.address;
  if (!account) return offerConnection(writer);
  writer.sayWithAccount("chat.welcomeLinked", { gardens: linkedGardens(writer, account) }, account);
}

/** `START` from a chat with no account yet: linking is offered first, and reporting needs no answer. */
function offerConnection(writer: TurnWriter): void {
  const binding = writer.ctx.binding;
  if (!binding) return writer.say("help");
  writer.ask(
    {
      subjectKind: "pairing",
      resourceId: binding.participantId,
      resourceRevision: null,
      kind: "connect_offer",
      options: [{ id: "connect", label: writer.text("link.offerLabel"), value: "connect" }],
    },
    () => writer.text("link.offer")
  );
}

/** A button press or a plain yes takes the offer; a plain no goes straight to reporting. */
export function answerConnectionOffer(writer: TurnWriter, accepted: boolean): void {
  if (accepted) return requestConnection(writer, null);
  if (writer.ctx.prompt) resolvePrompt(writer.core, writer.ctx.prompt.id);
  writer.say("link.offerDeclined");
}

/**
 * `CONNECT`, or an account address sent on its own, links an account before any report. A named
 * address is only a request: the bot says which gardens the indexer shows it in, which anyone can
 * look up, and sends a link that accepts a proof from that account alone.
 */
export function requestConnection(writer: TurnWriter, named: Address | null): void {
  const { core, ctx } = writer;
  if (ctx.prompt?.kind === "connect_offer") resolvePrompt(core, ctx.prompt.id);
  if (!ctx.binding) return writer.say("help");
  const linked = ctx.account?.address ?? null;
  if (linked) {
    if (named && named !== linked) return writer.say("link.accountMismatch", { account: linked });
    const memberships = core.gardens.membershipsOf(linked);
    if (core.settings.communityGarden && memberships.ok && memberships.gardens.length === 0) {
      return writer.say(
        "link.joinCommunity",
        { account: linked },
        {
          url: accountLink(writer, ctx.binding, linked),
          label: writer.text("link.joinCommunityLabel"),
        }
      );
    }
    return writer.sayWithAccount(
      "link.already",
      { gardens: linkedGardens(writer, linked) },
      linked
    );
  }
  const link = { url: accountLink(writer, ctx.binding, named), label: writer.text("link.label") };
  // What the indexer shows a named account in is said only when it could be read.
  const memberships = named ? core.gardens.membershipsOf(named) : null;
  if (named && memberships?.ok) {
    const gardens = gardenNames(writer, memberships.gardens);
    writer.say(
      gardens ? "link.connectNamed" : "link.connectNamedNoGardens",
      { account: named, gardens },
      link
    );
  } else {
    writer.say("link.connect", {}, link);
  }
  writer.say("link.pairHint");
  // The page signs with the account the browser last used with Green Goods. A chat that had an
  // account before is likely to find that one there, so it is told how to use another.
  if (hadAccount(writer, ctx.binding.participantId)) writer.say("link.otherAccountHint");
}

/** Whether this chat's person was linked to an account before, which they have since let go. */
function hadAccount(writer: TurnWriter, participantId: string): boolean {
  return (
    writer.core.db
      .query(
        "SELECT 1 FROM account_bindings WHERE participant_id = $participant AND status = 'revoked' LIMIT 1"
      )
      .get({ participant: participantId }) !== null
  );
}

/** A report in one of these states has nothing prepared or sent for its account yet. */
const UNLINKABLE_STATES = new Set(["collecting", "review", "authority"]);

/** Questions that only make sense for the account the chat was linked to. */
const ACCOUNT_PROMPTS = new Set([
  "publication_consent",
  "join_community",
  "grant_choice",
  "connect_offer",
]);

/**
 * `DISCONNECT` ends this chat's link to its account so another can be linked; `SWITCH` does that
 * and sends the link for the next account in the same reply. Chat permissions approved for the
 * account are paused and never used again, its open links and browser sessions end, and a report
 * confirmed for it asks for the new account before it is published. Nothing on chain changes. A
 * report or review that already has something prepared, signed or sent keeps the link until it
 * finishes, so a publication can never lose its author half way.
 */
export function disconnectAccount(writer: TurnWriter, thenConnect: boolean): void {
  const { core, ctx } = writer;
  const binding = ctx.binding;
  if (!binding) return writer.say("help");
  const account = ctx.account;
  if (!account) return thenConnect ? requestConnection(writer, null) : writer.say("link.notLinked");
  // Only work that is still open counts. A report or review that was cancelled, expired or
  // published leaves its operation behind in whatever state it had reached, and that must not
  // hold the account to the chat.
  const inFlight = core.db
    .query(
      `SELECT 1 FROM execution_operations o
         LEFT JOIN work_drafts d ON d.id = o.draft_id
         LEFT JOIN review_intents r ON r.id = o.review_intent_id
       WHERE o.author_account_id = $account
         AND o.state NOT IN ('published','failed','cancelled','preparation_failed')
         AND (d.lifecycle = 'open' OR r.lifecycle = 'open') LIMIT 1`
    )
    .get({ account: account.id });
  const draftBusy = ctx.draft && !UNLINKABLE_STATES.has(lifecycleState(ctx.draft));
  if (inFlight || draftBusy || ctx.review) return writer.say("link.disconnectBusy");
  const now = core.clock.now();
  core.db
    .query(
      "UPDATE account_bindings SET status = 'revoked', revoked_at = $now WHERE id = $id AND status = 'active'"
    )
    .run({ id: account.id, now });
  core.db
    .query(
      `UPDATE execution_grants SET state = 'paused', version = version + 1, updated_at = $now
       WHERE account_binding_id = $account AND state = 'active'`
    )
    .run({ account: account.id, now });
  core.db
    .query(
      "UPDATE continuation_requests SET state = 'revoked' WHERE participant_id = $participant AND state = 'open'"
    )
    .run({ participant: binding.participantId });
  revokeParticipantSessions(core, binding.participantId);
  endRecognition(core, binding.participantId);
  const gardenQuestion = ctx.prompt?.kind === "select_garden";
  // A garden question listed this account's gardens. The account that is linked next gets its own
  // list when it pairs, so until then the question is closed and not left to be answered.
  if (ctx.prompt && (ACCOUNT_PROMPTS.has(ctx.prompt.kind) || (gardenQuestion && thenConnect)))
    closeConversationPrompt(core, ctx.conversationId);
  audit(core, "account_disconnected", { kind: "participant", id: binding.participantId });
  ctx.account = null;
  writer.say("link.disconnected", { account: account.address });
  // An open summary named this account. It is put again without it, so its Confirm can no longer
  // be pressed for a publication from an account that summary never named.
  if (ctx.draft && ctx.prompt?.kind === "confirm_report") askConfirmation(writer, ctx.draft, null);
  // A chat that stays without an account chooses from every garden again.
  if (ctx.draft && gardenQuestion && !thenConnect) askGarden(writer, ctx.draft, null);
  if (thenConnect) requestConnection(writer, null);
}

/**
 * Carries a report that is still being put together on under the account just linked. A garden
 * that account does not report to comes off the report: the gardener changed the account
 * themselves, so the clearing is recorded as theirs and their earlier choice does not stand
 * against it. When the account's gardens cannot be read, a garden the report names cannot be
 * checked against them, so the report waits at the garden question, which says so. Otherwise the
 * report asks whatever it now needs, taking the account's only garden or naming the account in
 * its summary. A report already confirmed is left to the account checks.
 */
function resumeUnderAccount(writer: TurnWriter, draft: DraftRecord, external: TurnExternal): void {
  const { core, ctx } = writer;
  const account = ctx.account?.address ?? null;
  if (!["collecting", "review"].includes(lifecycleState(draft))) return;
  const work: Working = { content: draft.content, snapshot: draft.snapshot, changed: false };
  const dropped = gardenToDrop(core.gardens, draft, account);
  if (dropped) {
    apply(work, [
      { field: "garden", value: null, provenance: gardenerFact(writer.sourceEntryId()) },
    ]);
    writer.say("report.gardenDropped", { garden: dropped.label });
  }
  // There is nothing to check the report's garden against, so it waits at the garden question.
  if (work.content.garden && gardenScope(core.gardens, account).kind === "unavailable")
    return askGarden(writer, draft, account);
  // A report waiting on its garden, showing its summary or left with no question asks what it
  // needs now. An open garden question is put again within this account's gardens, and a
  // question about the report's details stays open as it was.
  if (!work.content.garden || !ctx.prompt || ctx.prompt.kind === "confirm_report")
    finish(writer, draft, work, external, "account");
  else if (ctx.prompt.kind === "select_garden") askGarden(writer, draft, account);
}

/**
 * Linking and publication consent in chat. Pairing completes only when the code shown in the
 * verifying browser arrives from this chat. A confirmation made before the account was linked is
 * replaced by a new one that names the account, recorded with publication consent for that digest.
 */
export function handlePairing(writer: TurnWriter, code: string, external: TurnExternal): void {
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
  const draft = ctx.draft;
  // A report in progress asks its own next question; otherwise the reply says where the account can report.
  writer.sayWithAccount(
    "link.paired",
    { gardens: draft || !ctx.account ? "" : linkedGardens(writer, ctx.account.address) },
    result.account
  );
  // A report waiting on its garden asks again within the account's own gardens, and an open
  // summary is put again naming the account, so what is confirmed next is the publication as it
  // will be made.
  if (draft && ctx.account) resumeUnderAccount(writer, draft, external);
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
