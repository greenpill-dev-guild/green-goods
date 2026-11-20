import {
  type ActionDefinitionSnapshot,
  buildReportSummary,
  reportContentDigest,
  reportSummaryDigest,
} from "@green-goods/shared/modules/agent-reporting";
import { WORK_UPLOAD_POLICY_VERSION } from "@green-goods/shared/modules/work/upload-policy";
import { awaitingSafeSigners, chainCheckStopped } from "../check-notices";
import { grantPublicationConsent, hasPublicationConsent } from "../consent";
import { currentConfirmation, invalidateConfirmation, recordConfirmation } from "../confirmations";
import type { ReportingCopyKey } from "../copy";
import type { DraftRecord } from "../drafts";
import { enqueueJob } from "../jobs";
import { operationForSubject } from "../operations";
import { setParticipantLocale } from "../participants";
import { retryPreparation } from "../preparation";
import { closeConversationPrompt, resolvePrompt } from "../prompts";
import type { ReportingCore } from "../runtime";
import { sendSigningLink, signingLinkLapsed, signingLinkOpen } from "../signing-links";
import type { ChatCommand } from "./commands";
import {
  commitContentChange,
  commitLifecycle,
  EDITABLE_STATES,
  lifecycleState,
} from "./draft-commit";
import { askEditMenu } from "./edit-menu";
import { askGarden, askJoin, sayJoin } from "./garden-step";
import { askAnotherGarden, askGrantChoice, gardenLabel, promptNextStep } from "./prompting";
import type { TurnExternal } from "./report-work";
import type { TurnWriter } from "./writer";

const STATE_COPY: Record<string, ReportingCopyKey> = {
  collecting: "state.collecting",
  review: "state.review",
  authority: "state.authority",
  grantChoice: "state.choice",
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
  // A report whose garden has left the list cannot be published, so it is not confirmed either.
  if (askAnotherGarden(writer, draft, ctx.account?.address ?? null)) return;
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

/** The languages the chat speaks, each offered by its own name. */
const LANGUAGES = [
  { locale: "en", label: "language.en" },
  { locale: "es", label: "language.es" },
  { locale: "pt", label: "language.pt" },
] as const;

/**
 * LANG on its own asks which language to use. A choice sends LANG with that language, so it stays
 * good whatever question is open, and the open question is left as it was.
 */
function askLanguage(writer: TurnWriter): void {
  const buttons = writer.usesButtons();
  writer.sayWithCommands(
    "language.ask",
    { how: buttons ? "" : writer.text("language.askWords") },
    buttons
      ? LANGUAGES.map(({ locale, label }) => ({
          word: `lang ${locale}`,
          label: writer.text(label),
        }))
      : []
  );
}

/**
 * What a report that can no longer change answers: that it is being published, or, once the chain
 * check ended without finding it, that the check stopped and where to turn.
 */
export function frozenReply(core: ReportingCore, draft: DraftRecord): ReportingCopyKey {
  return chainCheckStopped(core, { draftId: draft.id }) ?? "report.frozen";
}

/**
 * RETRY for a report waiting on its owner's signature sends a fresh way to give it, whether or not
 * the last link has expired: a page link for a prepared report, or the choice of how to publish
 * again for one waiting on that choice. False when the report waits for something else.
 */
function resendSigning(writer: TurnWriter, draft: DraftRecord): boolean {
  const { core } = writer;
  const state = lifecycleState(draft);
  const garden = draft.content.garden;
  if (state === "grantChoice" && garden) {
    askGrantChoice(writer, draft, garden.address);
    return true;
  }
  if (state !== "awaitingWallet") return false;
  const operation = operationForSubject(core, { draftId: draft.id });
  return operation?.state === "prepared" && sendSigningLink(core, writer, draft, operation);
}

function cancelDraft(writer: TurnWriter): void {
  const { core, ctx } = writer;
  const draft = ctx.draft;
  if (!draft) return writer.say("report.nothingToCancel");
  const { refused } = commitLifecycle(core, draft, [{ type: "CANCEL" }], {
    participantAction: true,
  });
  if (refused.length > 0) return writer.say(frozenReply(core, draft));
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

/** Only unsent reports with an older agreement can return to confirmation. */
function needsPolicyRenewal(core: TurnWriter["core"], draft: DraftRecord): boolean {
  if (!EDITABLE_STATES.has(lifecycleState(draft))) return false;
  if (operationForSubject(core, { draftId: draft.id })?.failureCode === "policy_changed")
    return true;
  const confirmation = currentConfirmation(core, { draftId: draft.id });
  if (!confirmation || confirmation.revision !== draft.revision) return false;
  const { summaryDigest } = confirmation;
  return (
    hasPublicationConsent(core, draft.id, draft.revision, summaryDigest) &&
    !hasPublicationConsent(
      core,
      draft.id,
      draft.revision,
      summaryDigest,
      WORK_UPLOAD_POLICY_VERSION
    )
  );
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
      return writer.say(draft ? frozenReply(core, draft) : "report.noStatus");
    case "garden":
      // The same question EDIT reaches through its menu, one word away.
      if (draft && EDITABLE_STATES.has(lifecycleState(draft)))
        return askGarden(writer, draft, ctx.account?.address ?? null);
      return writer.say(draft ? frozenReply(core, draft) : "report.noStatus");
    case "join": {
      const account = ctx.account?.address;
      if (!account) return writer.say("link.notLinked");
      // A report that can still change its garden gets the way back to its gardens with it.
      if (draft && EDITABLE_STATES.has(lifecycleState(draft)))
        return askJoin(writer, draft, account);
      return sayJoin(writer, account);
    }
    case "new":
      return writer.say(draft ? "report.resumeFirst" : "report.newStarted");
    case "status": {
      if (!draft) return writer.say("report.noStatus");
      const stopped =
        chainCheckStopped(core, { draftId: draft.id }) ??
        awaitingSafeSigners(core, { draftId: draft.id });
      if (stopped) return writer.say(stopped);
      // An open question about how to publish is what the report waits on, link or no link, while
      // the report is still at that choice. A permission page can move it on without an answer.
      const lifecycle = lifecycleState(draft);
      const choosing = ctx.prompt?.kind === "grant_choice" && lifecycle === "grantChoice";
      if (!choosing && signingLinkLapsed(core, draft)) return writer.say("publish.linkExpired");
      // After the choice, a report waits on the page its link opens.
      const state =
        lifecycle === "grantChoice" && !choosing && signingLinkOpen(core, draft.id)
          ? "state.signature"
          : (STATE_COPY[lifecycle] ?? "state.publishing");
      return writer.say("report.status", {
        garden: gardenLabel(core.gardens, draft.content.garden?.address),
        state: writer.text(state),
      });
    }
    case "retry": {
      if (draft && needsPolicyRenewal(core, draft)) {
        const reopened = commitContentChange(core, draft, {
          content: draft.content,
          cause: "upload-policy-renewed",
          sourceEventId: ctx.event.id,
        });
        return promptNextStep(writer, reopened, external.catalog);
      }
      if (draft && retryPreparation(core, draft.id)) return writer.say("publish.sending");
      if (draft && lifecycleState(draft) === "authority") {
        enqueueJob(core, {
          kind: "resolve_authority",
          subjectId: draft.id,
          dedupeKey: `authority:${draft.id}:retry:${core.clock.now()}`,
        });
        return;
      }
      if (draft && resendSigning(writer, draft)) return;
      return handleReportCommand(writer, { kind: "status" }, external);
    }
    case "locale":
      if (!command.locale) return askLanguage(writer);
      if (ctx.binding) setParticipantLocale(core, ctx.binding.participantId, command.locale);
      // Every reply from here on, this one's included, is in the language just chosen.
      ctx.locale = command.locale;
      return writer.say("help");
    default:
      return writer.say("help");
  }
}
