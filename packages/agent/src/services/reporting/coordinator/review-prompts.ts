import { reviewRequirements } from "@green-goods/shared/modules/agent-reporting";
import { Confidence } from "@green-goods/shared/types/domain";
import type { PromptOption } from "../prompts";
import type { ReviewRecord } from "../reviews";
import { gardenLabel } from "./prompting";
import type { ConversationWriter } from "./writer";

/** Questions and the token-bound summary for a steward's decision, rendered from validated state. */
const REVIEW_PROMPTS = new Set([
  "select_review_work",
  "review_decision",
  "review_confidence",
  "review_feedback",
  "confirm_review",
]);

const option = (id: string, label: string, value: string): PromptOption => ({ id, label, value });

export function isReviewPrompt(kind: string | undefined): boolean {
  return kind !== undefined && REVIEW_PROMPTS.has(kind);
}

/** Asks for whatever the decision still needs, or shows the token-bound summary. */
export function nextReviewStep(
  writer: ConversationWriter,
  review: ReviewRecord,
  account: string
): void {
  const base = {
    subjectKind: "review" as const,
    resourceId: review.id,
    resourceRevision: review.revision,
  };
  const [missing] = reviewRequirements(review.content);
  if (missing === "decision") {
    writer.ask(
      {
        ...base,
        kind: "review_decision",
        options: [
          option("approve", writer.text("review.approve"), "approve"),
          option("reject", writer.text("review.reject"), "reject"),
        ],
      },
      () =>
        writer.text("review.askDecision", {
          title: review.workTitle,
          gardener: review.content.gardenerAddress,
        })
    );
    return;
  }
  if (missing === "confidence") {
    writer.ask(
      {
        ...base,
        kind: "review_confidence",
        options: [Confidence.LOW, Confidence.MEDIUM, Confidence.HIGH].map((level) =>
          option(String(level), writer.text(`review.confidence.${level}` as const), String(level))
        ),
      },
      () => writer.text("review.askConfidence")
    );
    return;
  }
  if (missing === "feedback") {
    writer.ask({ ...base, kind: "review_feedback" }, () =>
      writer.text(
        review.content.decision === "reject" ? "review.askRejectionFeedback" : "review.askFeedback"
      )
    );
    return;
  }
  askReviewConfirmation(writer, review, account);
}

export function askReviewConfirmation(
  writer: ConversationWriter,
  review: ReviewRecord,
  _account: string
): void {
  const { content } = review;
  writer.ask(
    {
      subjectKind: "review",
      resourceId: review.id,
      resourceRevision: review.revision,
      kind: "confirm_review",
      options: [
        option("confirm", writer.text("report.confirm"), "confirm"),
        option("edit", writer.text("report.edit"), "edit"),
        option("cancel", writer.text("report.cancel"), "cancel"),
      ],
    },
    (prompt) =>
      writer.text("review.summary", {
        title: review.workTitle,
        garden: gardenLabel(writer.core.gardens, content.gardenAddress),
        decision: writer.text(content.decision === "reject" ? "review.reject" : "review.approve"),
        confidence:
          content.decision === "reject"
            ? writer.text("review.confidence.0")
            : writer.text(`review.confidence.${content.confidence ?? 1}` as "review.confidence.1"),
        feedback: content.feedback || writer.text("review.noFeedback"),
        token: prompt.token,
        instruction: writer.text(
          writer.usesButtons()
            ? "review.summaryButtonInstruction"
            : "review.summaryCodeInstruction",
          { token: prompt.token }
        ),
      })
  );
}
