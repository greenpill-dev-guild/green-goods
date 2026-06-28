// Read-only summary for the final "Review" step of the Submit Work flow. Mirrors
// the client PWA's review-before-submit moment, but built from admin Surface +
// M3/semantic tokens (no client component imports, no glass). Values are read
// from the react-hook-form snapshot; media previews use object URLs revoked on
// unmount. Each section header carries an Edit control that jumps back to its
// step so a value can be corrected without walking the flow again.
import { Surface, type Action } from "@green-goods/shared";
import { type ReactNode, useEffect, useMemo } from "react";
import { useIntl } from "react-intl";

export interface SubmitWorkReviewProps {
  action: Action;
  images: File[];
  values: Record<string, unknown>;
  photoRequirementText: string;
  /** Jump back to a step to edit it (1=Action, 2=Media, 3=Details). */
  onEditStep?: (step: number) => void;
}

function ReviewRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-xs font-medium text-text-sub">{label}</span>
      <span className="min-w-0 break-words text-sm text-text-strong sm:max-w-[60%] sm:text-right">
        {value}
      </span>
    </div>
  );
}

function ReviewCard({
  title,
  onEdit,
  editText,
  children,
}: {
  title: string;
  onEdit?: () => void;
  editText?: string;
  children: ReactNode;
}) {
  return (
    <Surface className="rounded-xl border border-stroke-soft bg-bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-sub">{title}</h3>
        {onEdit && editText ? (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`${editText} ${title}`}
            className="rounded text-xs font-medium text-[rgb(var(--tone-on-surface-accent,var(--m3-primary)))] transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-action,var(--primary-action)))]"
          >
            {editText}
          </button>
        ) : null}
      </div>
      {children}
    </Surface>
  );
}

export function SubmitWorkReview({
  action,
  images,
  values,
  photoRequirementText,
  onEditStep,
}: SubmitWorkReviewProps) {
  const { formatMessage } = useIntl();
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
    defaultMessage: "—",
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
      <ReviewCard
        title={formatMessage({ id: "app.admin.work.submit.step.action", defaultMessage: "Action" })}
        onEdit={onEditStep ? () => onEditStep(1) : undefined}
        editText={edit}
      >
        <p className="text-sm font-semibold text-text-strong">{action.title}</p>
        <p className="mt-0.5 text-xs text-text-sub">{photoRequirementText}</p>
      </ReviewCard>

      {action.inputs.length > 0 ? (
        <ReviewCard
          title={formatMessage({
            id: "app.admin.work.submit.section.details",
            defaultMessage: "Details",
          })}
          onEdit={onEditStep ? () => onEditStep(3) : undefined}
          editText={edit}
        >
          <div className="divide-y divide-stroke-soft">
            {action.inputs.map((input) => {
              const raw = values[input.key];
              const value =
                raw === undefined || raw === null || raw === "" ? emptyValue : String(raw);
              return <ReviewRow key={input.key} label={input.title} value={value} />;
            })}
          </div>
        </ReviewCard>
      ) : null}

      <ReviewCard
        title={formatMessage({
          id: "app.admin.work.submit.section.log",
          defaultMessage: "Time & notes",
        })}
        onEdit={onEditStep ? () => onEditStep(3) : undefined}
        editText={edit}
      >
        <div className="divide-y divide-stroke-soft">
          <ReviewRow
            label={formatMessage({
              id: "app.admin.work.submit.timeSpent",
              defaultMessage: "Time spent",
            })}
            value={timeValue}
          />
          <ReviewRow
            label={formatMessage({ id: "app.admin.work.submit.feedback", defaultMessage: "Notes" })}
            value={feedback || emptyValue}
          />
        </div>
      </ReviewCard>

      <ReviewCard
        title={formatMessage({
          id: "app.admin.work.submit.section.photos",
          defaultMessage: "Photos",
        })}
        onEdit={onEditStep ? () => onEditStep(2) : undefined}
        editText={edit}
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
          <p className="text-sm text-text-sub">
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
