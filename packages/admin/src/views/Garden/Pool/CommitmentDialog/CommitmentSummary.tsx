import { StatusBadge } from "@green-goods/shared";
import { type CommitmentReadModel } from "@green-goods/shared/commitment-pooling";
import { useIntl } from "react-intl";
import {
  commitmentStateChip,
  directionLabel,
  formatUnixDate,
  shortAddress,
} from "../poolPresentation";
import { type FallbackPath, STAGES, stageLabels } from "./commitmentDialogPresentation";

/**
 * The record's identity: what kind of thing it is, who it is between, what it
 * asks for and how far along it stands.
 */
export function CommitmentSummary({
  commitment,
  title,
  note,
  isDue,
  fallbackPath,
  stage,
}: {
  commitment: CommitmentReadModel;
  title: string;
  /** The author's own words about the record, when the metadata carries them. */
  note: string | null;
  isDue: boolean;
  fallbackPath: FallbackPath;
  /** Where the record stands on STAGES, or -1 once it has left the lifecycle. */
  stage: number;
}) {
  const { formatMessage, locale } = useIntl();
  const chip = commitmentStateChip(commitment, formatMessage);
  const labels = stageLabels(commitment.direction, formatMessage);

  return (
    <>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge variant="info" size="sm">
            {directionLabel(commitment.direction, formatMessage)}
          </StatusBadge>
          <StatusBadge variant={chip.variant} size="sm">
            {chip.label}
          </StatusBadge>
          {isDue ? (
            <StatusBadge variant="error" size="sm">
              {formatMessage({ id: "cockpit.garden.pool.row.pastDue", defaultMessage: "Past due" })}
            </StatusBadge>
          ) : null}
          {fallbackPath ? (
            <StatusBadge variant="warning" size="sm">
              {formatMessage({
                id: "cockpit.garden.pool.commitment.fallbackEligible",
                defaultMessage: "Ordinary confirmation unreachable",
              })}
            </StatusBadge>
          ) : null}
        </div>
        <h3 className="text-base font-semibold text-text-strong" title={title}>
          {title}
        </h3>
        <p className="text-sm text-text-soft">
          {[
            commitment.counterparty
              ? `${shortAddress(commitment.creator)} → ${shortAddress(commitment.counterparty)}`
              : shortAddress(commitment.creator),
            `${commitment.targetUnits.toString()} ${commitment.unitLabel ?? ""}`.trim(),
            commitment.dueDate
              ? formatMessage(
                  { id: "cockpit.garden.pool.row.due", defaultMessage: "due {date}" },
                  { date: formatUnixDate(commitment.dueDate, locale, "—") }
                )
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {note ? <p className="text-sm text-text-sub">{note}</p> : null}
      </header>

      {stage >= 0 ? (
        <ol
          className="flex flex-wrap gap-1 text-xs"
          aria-label={formatMessage({
            id: "cockpit.garden.pool.commitment.stages",
            defaultMessage: "Lifecycle",
          })}
        >
          {STAGES.map((key, index) => (
            <li
              key={key}
              aria-current={index === stage ? "step" : undefined}
              className={
                index <= stage
                  ? "rounded-full bg-[rgb(var(--m3-secondary-container))] px-2 py-0.5 text-[rgb(var(--m3-on-secondary-container))]"
                  : "rounded-full bg-[rgb(var(--m3-surface-container-highest))] px-2 py-0.5 text-text-soft"
              }
            >
              {labels[key]}
            </li>
          ))}
        </ol>
      ) : null}
    </>
  );
}
