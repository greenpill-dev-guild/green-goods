import {
  type ActionDefinitionSnapshot,
  buildReportSummary,
  reportContentDigest,
  reportSummaryDigest,
} from "@green-goods/shared/modules/agent-reporting";
import { grantPublicationConsent } from "../consent";
import { invalidateConfirmation, recordConfirmation } from "../confirmations";
import { type ReportingCopyKey, reportingText } from "../copy";
import type { DraftRecord } from "../drafts";
import { enqueueJob } from "../jobs";
import { setParticipantLocale } from "../participants";
import { retryPreparation } from "../preparation";
import { closeConversationPrompt, resolvePrompt } from "../prompts";
import type { ChatCommand } from "./commands";
import { commitLifecycle, EDITABLE_STATES, lifecycleState } from "./draft-commit";
import { askEditMenu } from "./edit-menu";
import { gardenLabel, promptNextStep } from "./prompting";
import type { TurnExternal } from "./report-work";
import type { TurnWriter } from "./writer";

const STATE_COPY: Record<string, ReportingCopyKey> = {
  collecting: "state.collecting",
  review: "state.review",
  authority: "state.authority",
  grantChoice: "state.authority",
  preparing: "state.preparing",
  preparationFailed: "state.preparing",
  awaitingWallet: "state.signature",
  delegatedPreflight: "state.publishing",
  sending: "state.publishing",
  reconciling: "state.publishing",
};

/**
 * Confirms the exact revision the open summary showed. The reply must carry that summary's token
 * (or be its button), so a confirmation can never apply to a revision the gardener did not see.
 * When the account is already linked, the same reply records publication consent for this digest.
 */
export function confirmDraft(
  writer: TurnWriter,
  token: string | null,
  fromButton: boolean,
  external: TurnExternal
): void {
  const { core, ctx } = writer;
  const draft = ctx.draft;
  const prompt = ctx.prompt;
  if (!draft) return writer.say("report.noStatus");
  const current =
    prompt?.kind === "confirm_report" &&
    prompt.subjectId === draft.id &&
    prompt.subjectRevision === draft.revision;
  if (!current || !prompt) return promptNextStep(writer, draft, external.catalog);
  if (!fromButton && token !== prompt.token)
    return writer.say("report.confirmToken", { token: prompt.token });

  const account = ctx.account;
  const summary = buildReportSummary({
    draftId: draft.id,
    revision: draft.revision,
    content: draft.content,
    snapshot: draft.snapshot,
    account: account?.address ?? null,
  });
  const summaryDigest = reportSummaryDigest(summary);
  const { refused } = commitLifecycle(
    core,
    draft,
    [{ type: "CONFIRMED", revision: draft.revision }],
    {
      participantAction: true,
      authorAccountId: account?.id ?? null,
    }
  );
  if (refused.length > 0) return promptNextStep(writer, draft, external.catalog);
  recordDraftConfirmation(writer, draft, summaryDigest, prompt.id, account?.id ?? null);
  resolvePrompt(core, prompt.id);
}

/** Records the confirmation (and publication consent when an account is bound) and schedules authority checks. */
export function recordDraftConfirmation(
  writer: TurnWriter,
  draft: DraftRecord,
  summaryDigest: string,
  promptId: string,
  accountBindingId: string | null
): void {
  const { core, ctx } = writer;
  const binding = ctx.binding;
  if (!binding) throw new Error("Confirmation requires a participant");
  const consentId = accountBindingId
    ? grantPublicationConsent(core, {
        subjectId: ctx.subjectId,
        participantId: binding.participantId,
        resourceKind: "draft",
        resourceId: draft.id,
        revision: draft.revision,
        digest: summaryDigest,
        sourceEventId: ctx.event.id,
      })
    : null;
  const garden = draft.content.garden;
  if (!garden) throw new Error("A confirmed report names its garden");
  const confirmationId = recordConfirmation(core, {
    subject: { draftId: draft.id },
    revision: draft.revision,
    summaryDigest,
    contentDigest: reportContentDigest(draft.content),
    actionDefinitionDigest: (draft.snapshot as ActionDefinitionSnapshot).digest,
    accountBindingId,
    gardenChainId: garden.chainId,
    gardenAddress: garden.address,
    sourceEventId: ctx.event.id,
    promptId,
    identityEpoch: binding.identityEpoch,
    publicationConsentId: consentId,
  });
  enqueueJob(core, {
    kind: "resolve_authority",
    subjectId: draft.id,
    dedupeKey: `authority:${draft.id}:${confirmationId}`,
  });
}

function cancelDraft(writer: TurnWriter): void {
  const { core, ctx } = writer;
  const draft = ctx.draft;
  if (!draft) return writer.say("report.nothingToCancel");
  const { refused } = commitLifecycle(core, draft, [{ type: "CANCEL" }], {
    participantAction: true,
  });
  if (refused.length > 0) return writer.say("report.frozen");
  closeConversationPrompt(core, ctx.conversationId);
  invalidateConfirmation(core, { draftId: draft.id });
  enqueueJob(core, {
    kind: "purge_private_content",
    subjectId: draft.id,
    dedupeKey: `purge:draft:${draft.id}`,
    payload: { scope: "draft" },
  });
  writer.say("report.cancelled");
}

export function handleReportCommand(
  writer: TurnWriter,
  command: ChatCommand,
  external: TurnExternal
): void {
  const { core, ctx } = writer;
  const draft = ctx.draft;
  switch (command.kind) {
    case "confirm":
      return confirmDraft(writer, command.token, false, external);
    case "cancel":
      return cancelDraft(writer);
    case "edit":
      if (draft && EDITABLE_STATES.has(lifecycleState(draft))) return askEditMenu(writer, draft);
      return writer.say(draft ? "report.frozen" : "report.noStatus");
    case "new":
      return writer.say(draft ? "report.resumeFirst" : "report.newStarted");
    case "status": {
      if (!draft) return writer.say("report.noStatus");
      const state = STATE_COPY[lifecycleState(draft)] ?? "state.publishing";
      return writer.say("report.status", {
        garden: gardenLabel(core.settings.gardens, draft.content.garden?.address),
        state: writer.text(state),
      });
    }
    case "retry": {
      if (draft && retryPreparation(core, draft.id)) return writer.say("publish.sending");
      if (draft && lifecycleState(draft) === "authority") {
        enqueueJob(core, {
          kind: "resolve_authority",
          subjectId: draft.id,
          dedupeKey: `authority:${draft.id}:retry:${core.clock.now()}`,
        });
        return;
      }
      return handleReportCommand(writer, { kind: "status" }, external);
    }
    case "locale":
      if (ctx.binding) setParticipantLocale(core, ctx.binding.participantId, command.locale);
      writer.reply(
        { text: reportingText(command.locale, "help", { support: core.settings.supportContact }) },
        "help"
      );
      return;
    default:
      return writer.say("help");
  }
}
