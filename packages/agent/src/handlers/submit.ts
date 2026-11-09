import { WORK_UPLOAD_POLICY_VERSION } from "@green-goods/shared/modules/work/upload-policy";
import type { Address } from "@green-goods/shared/types/domain";
import { parseWorkText } from "../services/ai";
import { agentMessage, type AgentLocale, normalizeAgentLocale } from "../i18n";
import * as db from "../services/db";
import { classifyError } from "../services/errors";
import { loggers } from "../services/logger";
import type {
  CallbackContent,
  HandlerResult,
  InboundMessage,
  ParsedWorkData,
  Session,
  TextContent,
  User,
  WorkDraftData,
} from "../types";
import {
  claimMessageIdempotency,
  completeMessageIdempotency,
  getExistingIdempotencyResponse,
  idempotencyInProgressResponse,
} from "./idempotency";

const log = loggers.handlers;
const PROTOCOL_WORK_TITLE = "Submission";

interface SubmissionReview {
  work: ParsedWorkData;
  token: string;
  policyVersion: string;
  uploaderAddress: string;
  gardenAddress: string | undefined;
  locale: AgentLocale;
}

export interface SubmitDeps {
  generateId: () => string;
  notifyOperator?: (operatorPlatformId: string, message: string) => Promise<void>;
}

export async function handleTextSubmission(
  message: InboundMessage,
  user: User,
  deps: SubmitDeps
): Promise<HandlerResult> {
  if (!canSubmitWork(user)) {
    return gardenerOnlyResponse(message.locale);
  }

  const { content } = message;
  const text = (content as TextContent).text;

  const workData = parseWorkText(text, message.locale);

  if (workData.tasks.length === 0) {
    return {
      response: {
        text: agentMessage(message.locale, "submit.noTasks"),
      },
    };
  }

  return showConfirmation(workData, user, deps.generateId(), message.locale);
}

export async function handleVoiceSubmission(
  message: InboundMessage,
  user: User,
  transcribedText: string,
  deps: SubmitDeps
): Promise<HandlerResult> {
  if (!canSubmitWork(user)) {
    return gardenerOnlyResponse(message.locale);
  }

  const workData = parseWorkText(transcribedText, message.locale);

  if (workData.tasks.length === 0) {
    return {
      response: {
        text: agentMessage(message.locale, "submit.voiceNoTasks", { transcribedText }),
      },
    };
  }

  return showConfirmation(workData, user, deps.generateId(), message.locale);
}

function showConfirmation(
  workData: ParsedWorkData,
  user: User,
  token: string,
  locale?: string
): HandlerResult {
  const review: SubmissionReview = {
    work: workData,
    token,
    policyVersion: WORK_UPLOAD_POLICY_VERSION,
    uploaderAddress: user.address,
    gardenAddress: user.currentGarden,
    locale: normalizeAgentLocale(locale),
  };
  const tasksSummary = workData.tasks
    .map((t) => {
      if (t.count) return `• ${t.type}: ${t.count} ${t.species}`;
      if (t.amount) return `• ${t.type}: ${t.amount}${t.unit} ${t.species}`;
      return `• ${t.type}: ${t.species}`;
    })
    .join("\n");

  return {
    response: {
      text:
        agentMessage(locale, "submit.confirm", {
          tasks: tasksSummary,
          notes: workData.notes,
          date: workData.date,
        }) +
        "\n\n" +
        agentMessage(locale, "submit.uploadTerms", { version: review.policyVersion }),
      parseMode: "markdown",
      buttons: [
        {
          label: agentMessage(locale, "submit.submitButton"),
          callbackData: `confirm_submission:${token}`,
        },
        { label: agentMessage(locale, "submit.cancelButton"), callbackData: "cancel_submission" },
      ],
    },
    updateSession: {
      step: "confirming_work",
      draft: review,
      updatedAt: Date.now(),
    },
  };
}

export async function handleConfirmSubmission(
  message: InboundMessage,
  user: User,
  session: Session,
  deps: SubmitDeps
): Promise<HandlerResult> {
  const { platform, sender } = message;
  const { generateId, notifyOperator } = deps;

  if (!canSubmitWork(user)) {
    return gardenerOnlyResponse(message.locale);
  }

  const idempotencyResponse = await getExistingIdempotencyResponse(
    "submit-confirm",
    message,
    "submission"
  );
  if (idempotencyResponse) {
    return {
      response: idempotencyResponse,
      clearSession: true,
    };
  }

  const review = session.draft as SubmissionReview | undefined;
  const callback = message.content as CallbackContent;
  if (
    !user.currentGarden ||
    session.step !== "confirming_work" ||
    !review?.work ||
    review.policyVersion !== WORK_UPLOAD_POLICY_VERSION ||
    review.uploaderAddress !== user.address ||
    review.gardenAddress !== user.currentGarden ||
    callback.data !== `confirm_submission:${review.token}`
  ) {
    return { response: { text: agentMessage(message.locale, "sessionExpired.submitInvalid") } };
  }
  const workData = review.work;

  try {
    const claimed = await claimMessageIdempotency("submit-confirm", message);
    if (!claimed) {
      return {
        response: idempotencyInProgressResponse("submission", message.locale),
        clearSession: true,
      };
    }

    const acceptedAt = new Date().toISOString();
    const draft: WorkDraftData = {
      actionUID: 0,
      title: PROTOCOL_WORK_TITLE,
      plantSelection: workData.tasks.filter((t) => t.species).map((t) => t.species),
      plantCount: workData.tasks.reduce((acc, t) => acc + (t.count || t.amount || 0), 0),
      feedback: workData.notes,
      media: [],
      uploadConsent: {
        policyVersion: WORK_UPLOAD_POLICY_VERSION,
        uploaderAddress: user.address as Address,
        termsAcceptedAt: acceptedAt,
        publicSharingAcceptedAt: acceptedAt,
        locale: review.locale,
        permissionsConfirmed: true,
      },
    };

    const pendingId = generateId();

    await db.addPendingWork({
      id: pendingId,
      actionUID: draft.actionUID,
      gardenerAddress: user.address,
      gardenerPlatform: platform,
      gardenerPlatformId: sender.platformId,
      gardenAddress: user.currentGarden,
      data: draft,
    });

    await db.clearSession(platform, sender.platformId);

    if (notifyOperator) {
      const operator = await db.getOperatorForGarden(user.currentGarden);
      if (operator) {
        await notifyOperator(
          operator.platformId,
          agentMessage(operator.locale, "notification.newSubmission", {
            address: `${user.address.slice(0, 6)}...${user.address.slice(-4)}`,
            workId: pendingId,
            notes: workData.notes,
          })
        );
      }
    }

    const result = {
      response: {
        text: agentMessage(message.locale, "submit.success", { workId: pendingId }),
        parseMode: "markdown" as const,
      },
      clearSession: true,
    };

    await completeMessageIdempotency("submit-confirm", message, result.response);

    return result;
  } catch (error) {
    const { category, userMessage } = classifyError(error, message.locale);
    log.error(
      { err: error, category, handler: "submit", externalMessageId: message.id },
      "Submission confirmation error"
    );

    const result = {
      response: {
        text: `❌ ${userMessage}`,
      },
      clearSession: true,
    };

    await completeMessageIdempotency("submit-confirm", message, result.response);

    return result;
  }
}

export async function handleCancelSubmission(
  message: InboundMessage,
  _deps: SubmitDeps
): Promise<HandlerResult> {
  const { platform, sender } = message;
  await db.clearSession(platform, sender.platformId);

  return {
    response: {
      text: agentMessage(message.locale, "submit.cancelled"),
    },
    clearSession: true,
  };
}

function canSubmitWork(user: User): boolean {
  return user.role === undefined || user.role === "gardener";
}

function gardenerOnlyResponse(locale?: string): HandlerResult {
  return {
    response: {
      text: agentMessage(locale, "submit.gardenerOnly"),
    },
  };
}
