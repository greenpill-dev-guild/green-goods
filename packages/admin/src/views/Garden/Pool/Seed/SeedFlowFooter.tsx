import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminLinearProgress } from "@/components/AdminLinearProgress";

export interface SeedFlowFooterProps {
  /** A creation is being queued: the whole flow is held. */
  busy: boolean;
  /** The dialog title, which the progress bar borrows as its label. */
  title: string;
  stepIndex: number;
  isLast: boolean;
  /** No pool, or a pool that is not open: nothing can be seeded into it. */
  seedDisabled: boolean;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onSeed: () => void;
}

/** The seeding console's pinned footer: progress on the left, step controls on the right. */
export function SeedFlowFooter({
  busy,
  title,
  stepIndex,
  isLast,
  seedDisabled,
  onCancel,
  onBack,
  onNext,
  onSeed,
}: SeedFlowFooterProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      <div className="min-w-0 sm:flex-1" aria-live="polite">
        {busy ? <AdminLinearProgress ariaLabel={title} /> : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <AdminButton
          type="button"
          variant={stepIndex === 0 ? "text" : "outlined"}
          onClick={() => (stepIndex === 0 ? onCancel() : onBack())}
          disabled={busy}
          className="self-start sm:self-auto"
        >
          {stepIndex === 0
            ? formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })
            : formatMessage({ id: "app.common.back", defaultMessage: "Back" })}
        </AdminButton>
        {isLast ? (
          <AdminButton
            type="button"
            variant="filled"
            onClick={onSeed}
            disabled={busy || seedDisabled}
            loading={busy}
            className="w-full sm:w-auto"
          >
            {formatMessage({
              id: "cockpit.garden.pool.seed.submit",
              defaultMessage: "Seed this commitment",
            })}
          </AdminButton>
        ) : (
          <AdminButton
            type="button"
            variant="filled"
            onClick={onNext}
            disabled={busy}
            className="w-full sm:w-auto"
          >
            {formatMessage({ id: "app.common.next", defaultMessage: "Next" })}
          </AdminButton>
        )}
      </div>
    </div>
  );
}
