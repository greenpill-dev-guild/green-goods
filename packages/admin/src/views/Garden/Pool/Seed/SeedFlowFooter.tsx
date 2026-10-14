import {
  CREATION_BUNDLE_SIZE,
  type CreationSendMode,
} from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import type { SeedStatusView } from "./seedStatus";

export interface SeedFlowFooterProps {
  stepIndex: number;
  isLast: boolean;
  /** Where the Review stands; the buttons and the note follow it. */
  status: SeedStatusView;
  mode: CreationSendMode | null;
  /** How many promises a Create makes. */
  total: number;
  /** Nothing can be created as things stand; `blockedReason` says why. */
  createDisabled: boolean;
  blockedReason?: string | null;
  /** Another like this would be one offer more than the steward has room for. */
  addAnotherDisabled: boolean;
  /** A new row only while nothing of this sitting exists yet. */
  canAddAnother: boolean;
  /** Some of the answer under review exists, so its steps can't be reopened. */
  backDisabled?: boolean;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onAddAnother: () => void;
  onCreate: () => void;
  onDone: () => void;
}

/**
 * The note beside a creating button: while the wallet asks, that the dialog
 * waits; otherwise why the button is off, or how many times the wallet will
 * ask. Seed Promises and Add to This Group say it the same way.
 */
export function SeedFlowNote({
  phase,
  busy,
  mode,
  count,
  reason,
}: {
  phase: string;
  busy: boolean;
  mode: CreationSendMode | null;
  /** How many the button sends. */
  count: number;
  /** Why the button is off, when it is. */
  reason: string | null;
}) {
  const { formatMessage } = useIntl();
  const note =
    phase === "asking"
      ? formatMessage({
          id: "cockpit.garden.pool.seed.note.waiting",
          defaultMessage: "The dialog stays open until your wallet answers.",
        })
      : busy
        ? null
        : (reason ??
          (mode === "bundle"
            ? count <= CREATION_BUNDLE_SIZE
              ? formatMessage(
                  {
                    id: "cockpit.garden.pool.seed.note.bundle",
                    defaultMessage:
                      "{count, plural, one {Your wallet will ask you once.} other {Your wallet will ask you once, for all #.}}",
                  },
                  { count }
                )
              : formatMessage(
                  {
                    id: "cockpit.garden.pool.seed.note.bundles",
                    defaultMessage: "Your wallet will ask you {requests} times, once for every 10.",
                  },
                  { requests: Math.ceil(count / CREATION_BUNDLE_SIZE) }
                )
            : mode === "one-by-one"
              ? formatMessage(
                  {
                    id: "cockpit.garden.pool.seed.note.oneByOne",
                    defaultMessage:
                      "{count, plural, one {Your wallet will ask you once.} =2 {Your wallet will ask you twice, one after the other.} other {Your wallet will ask you # times, one after another.}}",
                  },
                  { count }
                )
              : mode === "background"
                ? formatMessage({
                    id: "cockpit.garden.pool.seed.note.background",
                    defaultMessage:
                      "They wait in this device's queue until you send them from the Promises tab.",
                  })
                : null));
  return note ? <span role="status">{note}</span> : null;
}

/**
 * The seeding flow's pinned footer. The last step says how many times the
 * wallet will ask beside the button that asks (interaction patterns §3), and
 * the buttons follow the status row: Create, then Try Again for what didn't
 * send, then Done.
 */
export function SeedFlowFooter({
  stepIndex,
  isLast,
  status,
  mode,
  total,
  createDisabled,
  blockedReason = null,
  addAnotherDisabled,
  canAddAnother,
  backDisabled = false,
  onCancel,
  onBack,
  onNext,
  onAddAnother,
  onCreate,
  onDone,
}: SeedFlowFooterProps) {
  const { formatMessage } = useIntl();
  const busy = status.busy;

  if (!isLast) {
    return (
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <AdminButton
          type="button"
          variant={stepIndex === 0 ? "text" : "outlined"}
          onClick={() => (stepIndex === 0 ? onCancel() : onBack())}
          className="self-start sm:self-auto"
        >
          {stepIndex === 0
            ? formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })
            : formatMessage({ id: "app.common.back", defaultMessage: "Back" })}
        </AdminButton>
        <AdminButton type="button" variant="filled" onClick={onNext} className="w-full sm:w-auto">
          {formatMessage({ id: "app.common.next", defaultMessage: "Next" })}
        </AdminButton>
      </div>
    );
  }

  if (status.phase === "created" || status.phase === "finishLater") {
    return (
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <AdminButton type="button" variant="filled" onClick={onDone} className="w-full sm:w-auto">
          {formatMessage({ id: "app.common.done", defaultMessage: "Done" })}
        </AdminButton>
      </div>
    );
  }

  const retrying = status.retry > 0;

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      <p className="min-w-0 body-xs text-text-soft sm:flex-1" data-testid="seed-prompt-count">
        <SeedFlowNote
          phase={status.phase}
          busy={busy}
          mode={mode}
          count={retrying ? status.retry : total}
          reason={createDisabled ? blockedReason : null}
        />
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <AdminButton
          type="button"
          variant="outlined"
          onClick={onBack}
          disabled={busy || backDisabled}
          className="self-start sm:self-auto"
        >
          {formatMessage({ id: "app.common.back", defaultMessage: "Back" })}
        </AdminButton>
        {canAddAnother && !retrying ? (
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
        ) : null}
        <AdminButton
          type="button"
          variant="filled"
          onClick={onCreate}
          disabled={busy || createDisabled}
          loading={busy}
          className="w-full sm:w-auto"
        >
          {retrying
            ? status.phase === "partial"
              ? formatMessage(
                  {
                    id: "cockpit.garden.pool.seed.tryAgainCount",
                    defaultMessage: "Try Again ({count})",
                  },
                  { count: status.retry }
                )
              : formatMessage({
                  id: "cockpit.garden.pool.setup.retry",
                  defaultMessage: "Try Again",
                })
            : formatMessage(
                {
                  id: "cockpit.garden.pool.seed.create",
                  defaultMessage: "{count, plural, one {Create Promise} other {Create # Promises}}",
                },
                { count: total }
              )}
        </AdminButton>
      </div>
    </div>
  );
}
