import { AddressDisplay, type CommitmentReadModel } from "@green-goods/shared";
import { useIntl } from "react-intl";

export function Meter({
  done,
  of,
  includesThisDevice = false,
}: {
  done: number;
  of: number;
  includesThisDevice?: boolean;
}) {
  const { formatMessage } = useIntl();
  const pct = of > 0 ? Math.round((Math.min(done, of) / of) * 100) : 0;
  const label = formatMessage(
    { id: includesThisDevice ? "app.confirm.meter.saved" : "app.confirm.meter.count" },
    { done: Math.min(done, of), of }
  );
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-text-sub-600">
        <span>{formatMessage({ id: "app.confirm.meter.label" })}</span>
        <span>{label}</span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-weak-50"
        role="progressbar"
        aria-label={formatMessage({ id: "app.confirm.meter.label" })}
        aria-valuenow={Math.min(done, of)}
        aria-valuemin={0}
        aria-valuemax={of}
        aria-valuetext={label}
      >
        <div className="h-full rounded-full bg-primary-action" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Who confirmed it, and by which path. A fallback always carries its reason. */

export function Provenance({ commitment }: { commitment: CommitmentReadModel }) {
  const { formatMessage } = useIntl();
  if (!commitment.fulfilledBy) return null;
  const path = commitment.confirmationPath ?? "ORDINARY";
  return (
    <p
      className="flex flex-wrap items-center gap-1 text-xs text-text-sub-600"
      data-component="ConfirmProvenance"
      data-path={path}
    >
      {formatMessage({ id: `app.confirm.provenance.${path}` })}
      <AddressDisplay address={commitment.fulfilledBy} showCopyButton={false} />
      {path !== "ORDINARY" && commitment.fallbackReason ? (
        <span className="w-full">
          {formatMessage(
            { id: "app.confirm.provenance.reason" },
            { reason: commitment.fallbackReason }
          )}
        </span>
      ) : null}
    </p>
  );
}
