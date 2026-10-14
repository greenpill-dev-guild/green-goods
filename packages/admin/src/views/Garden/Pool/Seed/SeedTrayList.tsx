import type { SeedTrayRow } from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { directionEdgeClass } from "../poolPresentation";

export interface SeedTrayListProps {
  /** The other answers in this sitting, beside the one under review. */
  rows: readonly SeedTrayRow[];
  /** A send is under way: nothing in the tray may change. */
  busy: boolean;
  /** Some of the row exists, or may: it keeps its answers. */
  isLocked: (clientCommitmentId: string) => boolean;
  onEdit: (clientCommitmentId: string) => void;
  onRemove: (clientCommitmentId: string) => void;
}

/**
 * The other answers on the review step: one line each, with the facts a
 * steward checks one by and the two things they can still do to it, while
 * nothing of it exists yet.
 */
export function SeedTrayList({ rows, busy, isLocked, onEdit, onRemove }: SeedTrayListProps) {
  const { formatMessage } = useIntl();
  if (rows.length === 0) return null;

  return (
    <div className="space-y-1.5" data-testid="seed-tray">
      <p className="label-xs text-text-soft">
        {formatMessage({
          id: "cockpit.garden.pool.seed.tray.added",
          defaultMessage: "Added so far",
        })}
      </p>
      <ul className="divide-y divide-stroke-soft">
        {rows.map((row) => {
          const { values } = row;
          const locked = isLocked(row.clientCommitmentId);
          const facts = [
            formatMessage(
              {
                id: "cockpit.garden.pool.seed.tray.count",
                defaultMessage: "{count, plural, one {1 promise} other {# promises}}",
              },
              { count: values.count ?? 1 }
            ),
            formatMessage(
              { id: "cockpit.garden.pool.seed.tray.each", defaultMessage: "{amount} {unit} each" },
              { amount: values.targetUnits, unit: values.unitLabel }
            ),
            formatMessage(
              {
                id: "cockpit.garden.pool.seed.tray.due",
                defaultMessage: "due in {days, plural, one {# day} other {# days}}",
              },
              { days: values.dueInDays }
            ),
            values.claimMode === "APPROVAL_GATED"
              ? formatMessage({
                  id: "cockpit.garden.pool.seed.claimMode.gated",
                  defaultMessage: "Steward-reviewed",
                })
              : formatMessage({
                  id: "cockpit.garden.pool.seed.claimMode.open",
                  defaultMessage: "Open",
                }),
          ].join(" · ");

          return (
            <li
              key={row.clientCommitmentId}
              className={`flex flex-wrap items-center gap-2 py-2 ps-3 ${directionEdgeClass(values.direction)}`}
            >
              {/* The basis lets the actions drop below the words where a phone has no room for both. */}
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate body-sm text-text-strong" title={values.title}>
                  {values.title}
                </p>
                <p className="truncate body-xs text-text-soft" title={facts}>
                  {facts}
                </p>
              </div>
              {locked ? null : (
                <span className="ml-auto flex items-center gap-1.5">
                  <AdminButton
                    type="button"
                    variant="text"
                    size="sm"
                    disabled={busy}
                    aria-label={formatMessage(
                      {
                        id: "cockpit.garden.pool.seed.tray.removeRow",
                        defaultMessage: "Remove {title}",
                      },
                      { title: values.title }
                    )}
                    onClick={() => onRemove(row.clientCommitmentId)}
                  >
                    {formatMessage({ id: "app.common.remove", defaultMessage: "Remove" })}
                  </AdminButton>
                  <AdminButton
                    type="button"
                    variant="outlined"
                    size="sm"
                    disabled={busy}
                    aria-label={formatMessage(
                      {
                        id: "cockpit.garden.pool.seed.tray.editRow",
                        defaultMessage: "Edit {title}",
                      },
                      { title: values.title }
                    )}
                    onClick={() => onEdit(row.clientCommitmentId)}
                  >
                    {formatMessage({ id: "app.common.edit", defaultMessage: "Edit" })}
                  </AdminButton>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
