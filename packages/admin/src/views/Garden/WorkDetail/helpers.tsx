import { Confidence, type Work, type WorkMetadata, VerificationMethod } from "@green-goods/shared";
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

export function getDefaultMethodForDomain(domainSlug?: string): number {
  if (!domainSlug) return VerificationMethod.HUMAN;
  if (domainSlug.startsWith("solar.")) return VerificationMethod.HUMAN | VerificationMethod.IOT;
  if (domainSlug.startsWith("edu.")) return VerificationMethod.HUMAN;
  return VerificationMethod.HUMAN;
}

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

/**
 * Definition row — label left, value right on one line (dialog interior
 * grammar §3.3). Halves the vertical footprint of the old stacked icon rows
 * that made the review dialog read as whitespace.
 */
export function DetailRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <p className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-text-soft">
        {icon ? (
          <span aria-hidden className="self-center [&>svg]:h-3.5 [&>svg]:w-3.5">
            {icon}
          </span>
        ) : null}
        {label}
      </p>
      <div className="min-w-0 text-right text-sm text-text-strong">{value}</div>
    </div>
  );
}

export function ReviewSummary({ work }: { work: Work }) {
  const { formatMessage } = useIntl();
  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-md bg-bg-weak p-3">
        <p className="text-xs font-medium text-text-soft">
          {formatMessage({ id: "app.work.detail.statusLabel" })}
        </p>
        <p className="mt-0.5 text-sm font-medium text-text-strong">
          {work.status === "approved"
            ? formatMessage({ id: "app.work.status.approved" })
            : formatMessage({ id: "app.work.status.rejected" })}
        </p>
      </div>
      <p className="text-xs text-text-soft">
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
        <DetailRow key={entry.label} label={entry.label} value={entry.value} />
      ))}
    </>
  );
}
