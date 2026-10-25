import { FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { Confidence, type Work, type WorkMetadata } from "@green-goods/shared/types/domain";
import { useIntl } from "react-intl";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Zod schema for the approval form (Rule 8: RHF + Zod)
// ─────────────────────────────────────────────────────────────

// Approval vs rejection is determined by which button the user clicks,
// so additional validation beyond type constraints happens in the submit handler.
export const workApprovalSchema = z.object({
  confidence: z.nativeEnum(Confidence),
  verificationMethod: z.number(),
  feedback: z.string().optional(),
});

export type WorkApprovalFormData = z.infer<typeof workApprovalSchema>;

// ─────────────────────────────────────────────────────────────
// Domain default method mapping
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Helper: parse work metadata safely
// ─────────────────────────────────────────────────────────────

export function parseWorkMetadata(metadataStr: string): Partial<WorkMetadata> | null {
  try {
    const parsed = JSON.parse(metadataStr);
    return parsed;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

export function ReviewSummary({ work }: { work: Work }) {
  const { formatMessage } = useIntl();
  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-md bg-bg-weak p-3">
        <p className="type-label-sm text-text-soft">
          {formatMessage({ id: "app.work.detail.statusLabel" })}
        </p>
        <p className="mt-0.5 type-body font-medium text-text-strong">
          {work.status === "approved"
            ? formatMessage({ id: "app.work.status.approved" })
            : formatMessage({ id: "app.work.status.rejected" })}
        </p>
      </div>
      {work.reviewFeedback ? (
        <div className="rounded-md bg-bg-weak p-3">
          <p className="type-label-sm text-text-soft">
            {formatMessage({
              id: "app.work.detail.reviewFeedback",
              defaultMessage: "Feedback to the gardener",
            })}
          </p>
          <p className="mt-0.5 whitespace-pre-line break-words type-body text-text-strong">
            {work.reviewFeedback}
          </p>
        </div>
      ) : null}
      <p className="type-meta text-text-soft">
        {formatMessage({ id: "app.work.detail.alreadyReviewed" })}
      </p>
    </div>
  );
}

export function renderMetadataDetails(metadata: Partial<WorkMetadata>): React.ReactNode {
  const entries: Array<{ label: string; value: string }> = [];

  if (metadata.timeSpentMinutes) {
    entries.push({ label: "Time Spent", value: `${metadata.timeSpentMinutes} min` });
  }

  if (metadata.actionSlug) {
    entries.push({ label: "Action Slug", value: metadata.actionSlug });
  }

  if (metadata.tags && metadata.tags.length > 0) {
    entries.push({ label: "Tags", value: metadata.tags.join(", ") });
  }

  // Render generic details
  if (metadata.details) {
    for (const [key, val] of Object.entries(metadata.details)) {
      if (val !== null && val !== undefined && val !== "") {
        const label = key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (s) => s.toUpperCase())
          .trim();
        entries.push({
          label,
          value: Array.isArray(val) ? val.join(", ") : String(val),
        });
      }
    }
  }

  if (entries.length === 0) return null;

  return (
    <>
      {entries.map((entry) => (
        <FactRow key={entry.label} label={entry.label} value={entry.value} />
      ))}
    </>
  );
}
