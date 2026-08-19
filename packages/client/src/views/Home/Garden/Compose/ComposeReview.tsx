import { Alert, type CommitmentComposerValues } from "@green-goods/shared";
import { useIntl } from "react-intl";

export interface ComposeReviewProps {
  values: CommitmentComposerValues;
  isOnline: boolean;
  hasPool: boolean;
}

/**
 * The last look before it becomes real.
 *
 * This screen's job is to say what placing it does to other people, not to
 * summarize the form back. So it names who will be able to take it up, what
 * confirmation will depend on, and — when the phone is offline — that it will
 * wait rather than quietly failing.
 */
export function ComposeReview({ values, isOnline, hasPool }: ComposeReviewProps) {
  const { formatMessage } = useIntl();
  const isRequest = values.direction === "REQUEST";

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium text-text-strong-950">
        {formatMessage({ id: "app.compose.review.legend" })}
      </h1>

      <section className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4">
        <p className="text-base font-medium text-text-strong-950">
          {formatMessage(
            { id: "app.commitments.row.units" },
            { count: String(values.targetUnits), unit: values.unitLabel.trim() }
          )}
        </p>
        <p className="mt-0.5 text-xs text-text-soft-400">
          {formatMessage({
            id: isRequest ? "app.commitments.direction.request" : "app.commitments.direction.offer",
          })}
        </p>
        <dl className="mt-3 space-y-2 border-t border-stroke-soft-200 pt-3 text-sm">
          <Row
            label={formatMessage({ id: "app.compose.terms.byWhen" })}
            value={formatMessage({ id: "app.compose.terms.days" }, { count: values.dueInDays })}
          />
          <Row
            label={formatMessage({ id: "app.compose.terms.openTeam" })}
            value={formatMessage({
              id: values.openTeam ? "app.compose.review.yes" : "app.compose.review.no",
            })}
          />
          <Row
            label={formatMessage({ id: "app.compose.terms.fallback" })}
            value={formatMessage({
              id: values.protocolFallbackEnabled
                ? "app.compose.review.yes"
                : "app.compose.review.no",
            })}
          />
        </dl>
      </section>

      <p className="text-sm leading-relaxed text-text-sub-600">
        {formatMessage({
          id: isRequest
            ? "app.compose.review.consequenceRequest"
            : "app.compose.review.consequenceOffer",
        })}
      </p>

      {!hasPool ? (
        <Alert variant="error" className="p-3">
          {formatMessage({ id: "app.compose.review.noPool" })}
        </Alert>
      ) : null}

      {!isOnline ? (
        <Alert variant="warning" className="p-3">
          {formatMessage({ id: "app.compose.review.offline" })}
        </Alert>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-soft-400">{label}</dt>
      <dd className="text-text-strong-950">{value}</dd>
    </div>
  );
}
