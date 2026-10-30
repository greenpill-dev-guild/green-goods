// Read-only summary for the final "Review" step of the Submit Work flow. Mirrors
// the client PWA's review-before-submit moment, but built from AdminCard +
// M3/semantic tokens (no client component imports, no glass). Values are read
// from the react-hook-form snapshot; media previews use object URLs revoked on
// unmount. Each section header carries an Edit control that jumps back to its
// step so a value can be corrected without walking the flow again. One status
// row above the sections says where the send stands and keeps its height while
// it works, so the sections under it never move (DL-072, DL-080).

import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import type { Action } from "@green-goods/shared/types/domain";
import { type ReactNode, useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { AdminCard } from "@/components/AdminCard";
import type { FlowSendStatus } from "@/components/Layout/FlowSendFooter";
import { FlowStatusRow } from "@/components/Layout/FlowStatusRow";

export interface SubmitWorkReviewProps {
  action: Action;
  images: File[];
  values: Record<string, unknown>;
  photoRequirementText: string;
  /** Where the send stands, in the one row that changes while it works. */
  status: FlowSendStatus;
  /** Jump back to a step to edit it (1=Action, 2=Media, 3=Details). */
  onEditStep?: (step: number) => void;
}

function ReviewCard({
  title,
  onEdit,
  editText,
  editable,
  children,
}: {
  title: string;
  onEdit?: () => void;
  editText?: string;
  /** Held, not hidden, while a send works: a header that lost its Edit would move the cards. */
  editable: boolean;
  children: ReactNode;
}) {
  return (
    <AdminCard variant="outlined">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="type-label-sm text-text-sub">{title}</h3>
        {onEdit && editText ? (
          <Button
            type="button"
            emphasis="tertiary"
            size="compact"
            onClick={onEdit}
            disabled={!editable}
            aria-label={`${editText} ${title}`}
          >
            {editText}
          </Button>
        ) : null}
      </div>
      {children}
    </AdminCard>
  );
}

export function SubmitWorkReview({
  action,
  images,
  values,
  photoRequirementText,
  status,
  onEditStep,
}: SubmitWorkReviewProps) {
  const { formatMessage } = useIntl();
  // Until the send lands the values stay the steward's to change, a failed send included.
  const editable = status.phase === "ready" || status.phase === "failed";
  const edit = formatMessage({ id: "app.common.edit", defaultMessage: "Edit" });

  const previews = useMemo(
    () => images.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })),
    [images]
  );
  useEffect(
    () => () => {
      for (const preview of previews) URL.revokeObjectURL(preview.url);
    },
    [previews]
  );

  const emptyValue = formatMessage({
    id: "app.admin.work.submit.review.empty",
    defaultMessage: "Not provided",
  });
  const rawTime = values.timeSpentMinutes;
  const timeValue =
    typeof rawTime === "number" && rawTime > 0
      ? formatMessage(
          { id: "app.admin.work.submit.review.hours", defaultMessage: "{hours} h" },
          { hours: rawTime }
        )
      : emptyValue;
  const feedback = typeof values.feedback === "string" ? values.feedback.trim() : "";

  return (
    <div className="space-y-3">
      <FlowStatusRow
        tone={status.tone}
        busy={status.busy}
        title={status.title}
        description={status.description}
      />
      <ReviewCard
        title={formatMessage({ id: "app.admin.work.submit.step.action", defaultMessage: "Action" })}
        onEdit={onEditStep ? () => onEditStep(1) : undefined}
        editText={edit}
        editable={editable}
      >
        <p className="type-body font-semibold text-text-strong">{action.title}</p>
        <p className="mt-0.5 type-meta text-text-sub">{photoRequirementText}</p>
      </ReviewCard>

      {action.inputs.length > 0 ? (
        <ReviewCard
          title={formatMessage({
            id: "app.admin.work.submit.section.details",
            defaultMessage: "Action details",
          })}
          onEdit={onEditStep ? () => onEditStep(3) : undefined}
          editText={edit}
          editable={editable}
        >
          <FactList frame="inset">
            {action.inputs.map((input) => {
              const raw = values[input.key];
              const value =
                raw === undefined || raw === null || raw === "" ? emptyValue : String(raw);
              return <FactRow key={input.key} label={input.title} value={value} />;
            })}
          </FactList>
        </ReviewCard>
      ) : null}

      <ReviewCard
        title={formatMessage({
          id: "app.admin.work.submit.section.log",
          defaultMessage: "Time & notes",
        })}
        onEdit={onEditStep ? () => onEditStep(3) : undefined}
        editText={edit}
        editable={editable}
      >
        <FactList frame="inset">
          <FactRow
            label={formatMessage({
              id: "app.admin.work.submit.timeSpent",
              defaultMessage: "Time Spent (hours)",
            })}
            value={timeValue}
          />
          <FactRow
            label={formatMessage({
              id: "app.admin.work.submit.feedback",
              defaultMessage: "Feedback",
            })}
            value={feedback || emptyValue}
          />
        </FactList>
      </ReviewCard>

      <ReviewCard
        title={formatMessage({
          id: "app.admin.work.submit.section.photos",
          defaultMessage: "Photos",
        })}
        onEdit={onEditStep ? () => onEditStep(2) : undefined}
        editText={edit}
        editable={editable}
      >
        {previews.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {previews.map((preview) => (
              <img
                key={preview.url}
                src={preview.url}
                alt={preview.name}
                className="aspect-square w-full rounded-lg border border-stroke-soft object-cover"
              />
            ))}
          </div>
        ) : (
          <p className="type-body text-text-sub">
            {formatMessage({
              id: "app.admin.work.submit.review.noPhotos",
              defaultMessage: "No photos added.",
            })}
          </p>
        )}
      </ReviewCard>
    </div>
  );
}

SubmitWorkReview.displayName = "SubmitWorkReview";
