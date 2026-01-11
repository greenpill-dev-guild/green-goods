/**
 * Submit Handler - Process work submission from text or voice
 */

import { parseWorkText } from "../services/ai";
import * as db from "../services/db";
import type {
  HandlerResult,
  InboundMessage,
  ParsedWorkData,
  Session,
  TextContent,
  User,
  WorkDraftData,
} from "../types";

export interface SubmitDeps {
  generateId: () => string;
  notifyOperator?: (operatorPlatformId: string, message: string) => Promise<void>;
}

/**
 * Handle text message as work submission
 */
export async function handleTextSubmission(
  message: InboundMessage,
  _user: User,
  _deps: SubmitDeps
): Promise<HandlerResult> {
  const { content } = message;
  const text = (content as TextContent).text;

  const workData = parseWorkText(text, message.locale);

  if (workData.tasks.length === 0) {
    return {
      response: {
        text:
          "🤔 I couldn't identify any work tasks from your message.\n\n" +
          "Try something like:\n" +
          '• "I planted 5 trees today"\n' +
          '• "Removed 10kg of weeds"\n' +
          '• "Planted 20 tomato seedlings"',
      },
    };
  }

  return showConfirmation(workData);
}

/**
 * Handle voice transcription result as work submission
 */
export async function handleVoiceSubmission(
  message: InboundMessage,
  _user: User,
  transcribedText: string,
  _deps: SubmitDeps
): Promise<HandlerResult> {
  const workData = parseWorkText(transcribedText, message.locale);

  if (workData.tasks.length === 0) {
    return {
      response: {
        text:
          `📝 I heard: "${transcribedText}"\n\n` +
          "🤔 I couldn't identify any work tasks from your message.\n\n" +
          "Try saying something like:\n" +
          '• "I planted 5 trees today"\n' +
          '• "Removed 10kg of weeds"',
      },
    };
  }

  return showConfirmation(workData);
}

/**
 * Show confirmation dialog for work submission
 */
function showConfirmation(workData: ParsedWorkData): HandlerResult {
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
        `📋 *Confirm your submission:*\n\n` +
        `*Tasks:*\n${tasksSummary}\n\n` +
        `*Notes:* ${workData.notes}\n` +
        `*Date:* ${workData.date}`,
      parseMode: "markdown",
      buttons: [
        { label: "✅ Submit", callbackData: "confirm_submission" },
        { label: "❌ Cancel", callbackData: "cancel_submission" },
      ],
    },
    updateSession: {
      step: "confirming_work",
      draft: workData,
      updatedAt: Date.now(),
    },
  };
}

/**
 * Handle confirmation of work submission
 */
export async function handleConfirmSubmission(
  message: InboundMessage,
  user: User,
  session: Session,
  deps: SubmitDeps
): Promise<HandlerResult> {
  const { platform, sender } = message;
  const { generateId, notifyOperator } = deps;

  if (!session.draft || !user.currentGarden) {
    return {
      response: {
        text: "Session expired or invalid. Please submit your work again.",
      },
      clearSession: true,
    };
  }

  const workData = session.draft as ParsedWorkData;

  const draft: WorkDraftData = {
    actionUID: 0,
    title: "Submission",
    plantSelection: workData.tasks.filter((t) => t.species).map((t) => t.species),
    plantCount: workData.tasks.reduce((acc, t) => acc + (t.count || t.amount || 0), 0),
    feedback: workData.notes,
    media: [],
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
        `🔔 *New Work Submission*\n\n` +
          `From: \`${user.address.slice(0, 6)}...${user.address.slice(-4)}\`\n` +
          `ID: \`${pendingId}\`\n\n` +
          `${workData.notes}\n\n` +
          `Reply with \`/approve ${pendingId}\` to approve.`
      );
    }
  }

  return {
    response: {
      text:
        `✅ *Work submitted for approval!*\n\n` +
        `ID: \`${pendingId}\`\n\n` +
        `An operator will review your submission soon.`,
      parseMode: "markdown",
    },
    clearSession: true,
  };
}

/**
 * Handle cancellation of work submission
 */
export async function handleCancelSubmission(
  message: InboundMessage,
  _deps: SubmitDeps
): Promise<HandlerResult> {
  const { platform, sender } = message;
  await db.clearSession(platform, sender.platformId);

  return {
    response: {
      text: "❌ Submission cancelled.",
    },
    clearSession: true,
  };
}
