import type { CommitmentComposerValues } from "@green-goods/shared";
import { RiAddLine, RiCloseLine } from "@remixicon/react";
import type { UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminTextField } from "@/components/AdminTextField";
import { CONFIRMER_ADDRESS_PATTERN, type SeedFieldError } from "./seedStepModel";

export interface SeedConfirmerListProps {
  form: UseFormReturn<CommitmentComposerValues>;
  values: CommitmentComposerValues;
  busy: boolean;
  errorOf: SeedFieldError;
  /** The address being typed, held by the dialog so it survives a step change. */
  confirmerDraft: string;
  onConfirmerDraftChange: (value: string) => void;
  onAddConfirmer: () => void;
}

/**
 * The named confirmer group and its threshold. Nobody named leaves the ordinary
 * rule in place, which reads differently for an offer than for a request.
 */
export function SeedConfirmerList({
  form,
  values,
  busy,
  errorOf,
  confirmerDraft,
  onConfirmerDraftChange,
  onAddConfirmer,
}: SeedConfirmerListProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-2" data-testid="seed-confirmers">
      <p className="label-md text-text-strong">
        {formatMessage({
          id: "cockpit.garden.pool.seed.confirmers",
          defaultMessage: "Confirmers",
        })}
      </p>
      <p className="text-xs text-text-soft">
        {values.confirmers.length === 0
          ? values.direction === "REQUEST"
            ? formatMessage({
                id: "cockpit.garden.pool.seed.confirmersDefaultRequest",
                defaultMessage:
                  "Nobody named: the pool, as the asker, confirms through its stewards.",
              })
            : formatMessage({
                id: "cockpit.garden.pool.seed.confirmersDefaultOffer",
                defaultMessage: "Nobody named: whoever takes this up confirms it.",
              })
          : formatMessage({
              id: "cockpit.garden.pool.seed.confirmersNamed",
              defaultMessage:
                "A named group. The lead and every contributor are excluded by the contract.",
            })}
      </p>
      {values.confirmers.length > 0 ? (
        <ul className="divide-y divide-[rgb(var(--m3-outline-variant))]">
          {values.confirmers.map((address) => (
            <li key={address} className="flex items-center justify-between gap-2 py-1.5">
              <span className="truncate font-mono text-xs text-text-strong" title={address}>
                {address}
              </span>
              <AdminButton
                type="button"
                variant="text"
                size="sm"
                aria-label={formatMessage({
                  id: "app.common.remove",
                  defaultMessage: "Remove",
                })}
                onClick={() =>
                  form.setValue(
                    "confirmers",
                    values.confirmers.filter((entry) => entry !== address),
                    { shouldDirty: true, shouldValidate: true }
                  )
                }
                disabled={busy}
              >
                <RiCloseLine className="h-4 w-4" />
              </AdminButton>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-end gap-2">
        <AdminTextField
          label={formatMessage({
            id: "cockpit.garden.pool.seed.confirmerAddress",
            defaultMessage: "Add an address",
          })}
          value={confirmerDraft}
          onChange={(event) => onConfirmerDraftChange(event.target.value)}
          placeholder="0x…"
          className="flex-1"
          disabled={busy}
        />
        <AdminButton
          type="button"
          variant="outlined"
          size="sm"
          leadingIcon={<RiAddLine className="h-4 w-4" />}
          onClick={onAddConfirmer}
          disabled={busy || !CONFIRMER_ADDRESS_PATTERN.test(confirmerDraft.trim())}
        >
          {formatMessage({
            id: "cockpit.garden.pool.seed.confirmerAdd",
            defaultMessage: "Add",
          })}
        </AdminButton>
      </div>
      {values.confirmers.length > 0 ? (
        <AdminTextField
          label={formatMessage({
            id: "cockpit.garden.pool.seed.threshold",
            defaultMessage: "How many must confirm",
          })}
          value={String(values.confirmationThreshold)}
          onChange={(event) =>
            form.setValue("confirmationThreshold", Number(event.target.value), {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          error={errorOf("confirmationThreshold")}
          helperText={formatMessage(
            {
              id: "cockpit.garden.pool.seed.thresholdHint",
              defaultMessage: "Of {count} named",
            },
            { count: values.confirmers.length }
          )}
          inputProps={{ inputMode: "numeric" }}
          className="w-40"
          disabled={busy}
        />
      ) : null}
    </div>
  );
}
