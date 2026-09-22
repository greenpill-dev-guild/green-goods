import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type { SeedTrayRow } from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";

export interface SeedTrayListProps {
  /** The commitments already added in this sitting, beside the one under review. */
  rows: readonly SeedTrayRow[];
  /** A send is under way: nothing in the tray may change. */
  busy: boolean;
  onEdit: (clientCommitmentId: string) => void;
  onRemove: (clientCommitmentId: string) => void;
}

/**
 * The seeding tray on the review step: one line per commitment added so far,
 * with the facts a steward checks a row by and the two things they can still do
 * to it. A row the last send created nothing for says so.
 */
export function SeedTrayList({ rows, busy, onEdit, onRemove }: SeedTrayListProps) {
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
      <ul className="divide-y divide-[rgb(var(--m3-outline-variant))]">
        {rows.map((row) => {
          const { values } = row;
          const facts = [
            values.direction === "REQUEST"
              ? formatMessage({
                  id: "cockpit.garden.pool.seed.direction.request",
                  defaultMessage: "The pool requests",
                })
              : formatMessage({
                  id: "cockpit.garden.pool.seed.direction.offer",
                  defaultMessage: "The pool offers",
                }),
            `${values.targetUnits} ${values.unitLabel}`,
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
            <li key={row.clientCommitmentId} className="flex flex-wrap items-center gap-2 py-2">
              {/* The basis lets the actions drop below the words where a phone has no room for both. */}
              <div className="min-w-0 flex-1 basis-56">
                <p className="flex items-center gap-2">
                  <span className="truncate text-body-md text-text-strong" title={values.title}>
                    {values.title}
                  </span>
                  {row.notSent ? (
                    <StatusBadge variant="error" size="sm" className="shrink-0 whitespace-nowrap">
                      {formatMessage({
                        id: "cockpit.garden.pool.seed.tray.notSent",
                        defaultMessage: "Not sent",
                      })}
                    </StatusBadge>
                  ) : null}
                </p>
                <p className="truncate text-xs text-text-soft" title={facts}>
                  {facts}
                </p>
              </div>
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
                    { id: "cockpit.garden.pool.seed.tray.editRow", defaultMessage: "Edit {title}" },
                    { title: values.title }
                  )}
                  onClick={() => onEdit(row.clientCommitmentId)}
                >
                  {formatMessage({ id: "app.common.edit", defaultMessage: "Edit" })}
                </AdminButton>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
