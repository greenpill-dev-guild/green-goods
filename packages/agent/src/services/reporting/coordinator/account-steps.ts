import {
  buildReportSummary,
  reportSummaryDigest,
} from "@green-goods/shared/modules/agent-reporting";
import type { Address } from "@green-goods/shared/types/domain";
import { pairFromChat } from "../channel-pairing";
import { issueContinuation } from "../continuations";
import { commitDraft } from "../drafts";
import { enqueueJob } from "../jobs";
import { conversationRealm } from "../notify";
import { upsertOperation } from "../operations";
import { activeAccount, bindingForSubject, type ParticipantBinding } from "../participants";
import { resolvePrompt } from "../prompts";
import { commitLifecycle, lifecycleState } from "./draft-commit";
import { recordDraftConfirmation } from "./report-commands";
import type { ConversationWriter, TurnWriter } from "./writer";

/** How many garden names a reply lists before it counts the rest. */
const NAMED_GARDENS = 5;

/**
 * The link on which an account is proven for this chat. Naming an account limits the link to it:
 * a proof from any other account is refused.
 */
export function accountLink(
  writer: ConversationWriter,
  binding: ParticipantBinding,
  expectedAccount: Address | null
): string {
  const { core, target } = writer;
  return issueContinuation(core, {
    purpose: "link_account",
    participantId: binding.participantId,
    subjectId: target.subjectId,
    bindingId: binding.bindingId,
    conversationId: target.conversationId,
    providerRealm: conversationRealm(core, target.conversationId),
    resourceKind: "account",
    resourceId: null,
    resourceRevision: null,
    resourceDigest: `account:${binding.participantId}`,
    expectedAccount,
    identityEpoch: binding.identityEpoch,
  }).url;
}

/** The names of the gardens the indexer shows an account in, or null when it shows none. */
function gardenNames(writer: TurnWriter, account: Address): string | null {
  const labels = writer.core.gardens.gardensOf(account).map((garden) => garden.label);
  if (labels.length === 0) return null;
  const named = labels.slice(0, NAMED_GARDENS).join(", ");
  return labels.length > NAMED_GARDENS
    ? writer.text("link.gardensMore", { gardens: named, count: labels.length - NAMED_GARDENS })
    : named;
}

/** The sentence a linked chat gets about its account's gardens. */
function linkedGardens(writer: TurnWriter, account: Address): string {
  const gardens = gardenNames(writer, account);
  return gardens ? writer.text("link.gardens", { gardens }) : writer.text("link.noGardens");
}

/** `START` from a chat with no account yet: linking is offered first, and reporting needs no answer. */
export function offerConnection(writer: TurnWriter): void {
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
    if (core.settings.communityGarden && core.gardens.gardensOf(linked).length === 0) {
      return writer.say(
        "link.joinCommunity",
        { account: linked },
        {
          url: accountLink(writer, ctx.binding, linked),
          label: writer.text("link.joinCommunityLabel"),
        }
      );
    }
    return writer.say("link.already", { account: linked, gardens: linkedGardens(writer, linked) });
  }
  const link = { url: accountLink(writer, ctx.binding, named), label: writer.text("link.label") };
  if (named) {
    const gardens = gardenNames(writer, named);
    writer.say(
      gardens ? "link.connectNamed" : "link.connectNamedNoGardens",
      { account: named, gardens: gardens ?? "" },
      link
    );
  } else {
    writer.say("link.connect", {}, link);
  }
  writer.say("link.pairHint");
}

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
  const draft = ctx.draft;
  // A report in progress asks its own next question; otherwise the reply says where the account can report.
  writer.say("link.paired", {
    account: result.account,
    gardens: draft || !ctx.account ? "" : linkedGardens(writer, ctx.account.address),
  });
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
