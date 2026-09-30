import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { promptCount } from "../SetupFlow/setupWrites";

export interface SeedFlowFooterProps {
  /**
   * Composing the tray, sending it (the body follows the pass row by row), or
   * done (the body says how each row ended).
   */
  phase: "compose" | "sending" | "done";
  /** A creation is being queued: the whole flow is held. */
  busy: boolean;
  stepIndex: number;
  isLast: boolean;
  /** No pool, or a pool that is not open: nothing can be seeded into it. */
  seedDisabled: boolean;
  /** Why seeding is off, said under the buttons the way the app composer's bar does. */
  blockedReason?: string | null;
  /** How many commitments seeding would make: the ones added so far, and this one. */
  count: number;
  /** Another like this would be one offer more than the steward has room for. */
  addAnotherDisabled: boolean;
  /** The last pass left rows in the tray that were not sent. */
  unsent: boolean;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onAddAnother: () => void;
  onSeed: () => void;
  /** Done: nothing is left to send, close the wizard. */
  onDone: () => void;
  /** Done with rows still in the tray: go back to them. */
  onBackToTray: () => void;
}

/**
 * The seeding console's pinned footer. While composing, the last step says how
 * many times the wallet will ask, beside the button that asks. Once a pass is
 * over it offers Done, or, with rows still unsent, Back to Review and Try
 * Again.
 */
export function SeedFlowFooter({
  phase,
  busy,
  stepIndex,
  isLast,
  seedDisabled,
  blockedReason = null,
  count,
  addAnotherDisabled,
  unsent,
  onCancel,
  onBack,
  onNext,
  onAddAnother,
  onSeed,
  onDone,
  onBackToTray,
}: SeedFlowFooterProps) {
  const { formatMessage } = useIntl();

  if (phase === "done") {
    return (
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        {/* A retry that cannot run says why, as the compose step does. */}
        {unsent && seedDisabled && blockedReason ? (
          <p className="min-w-0 body-xs text-text-soft sm:flex-1">
            <span role="status">{blockedReason}</span>
          </p>
        ) : null}
        {unsent ? (
          <>
            <AdminButton type="button" variant="outlined" onClick={onBackToTray}>
              {formatMessage({
                id: "cockpit.garden.pool.seed.backToReview",
                defaultMessage: "Back to Review",
              })}
            </AdminButton>
            <AdminButton
              type="button"
              variant="filled"
              onClick={onSeed}
              disabled={seedDisabled}
              className="w-full sm:w-auto"
            >
              {formatMessage({
                id: "cockpit.garden.pool.setup.retry",
                defaultMessage: "Try Again",
              })}
            </AdminButton>
          </>
        ) : (
          <AdminButton type="button" variant="filled" onClick={onDone} className="w-full sm:w-auto">
            {formatMessage({ id: "app.common.done", defaultMessage: "Done" })}
          </AdminButton>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      <p className="min-w-0 body-xs text-text-soft sm:flex-1" data-testid="seed-prompt-count">
        {isLast && phase === "compose" ? (
          seedDisabled && blockedReason && !busy ? (
            <span role="status">{blockedReason}</span>
          ) : (
            promptCount(count, formatMessage)
          )
        ) : null}
      </p>
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
          <>
            <AdminButton
              type="button"
              variant="outlined"
              onClick={onAddAnother}
              disabled={busy || addAnotherDisabled}
              className="w-full sm:w-auto"
            >
              {formatMessage({
                id: "cockpit.garden.pool.seed.addAnother",
                defaultMessage: "Add Another Like This",
              })}
            </AdminButton>
            <AdminButton
              type="button"
              variant="filled"
              onClick={onSeed}
              disabled={busy || seedDisabled}
              loading={busy}
              className="w-full sm:w-auto"
            >
              {count > 1
                ? formatMessage(
                    {
                      id: "cockpit.garden.pool.seed.submitAll",
                      defaultMessage: "Create All ({count})",
                    },
                    { count }
                  )
                : formatMessage({
                    id: "cockpit.garden.pool.seed.submit",
                    defaultMessage: "Seed This Commitment",
                  })}
            </AdminButton>
          </>
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
