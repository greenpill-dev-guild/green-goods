import type { IssuerSafeThreshold } from "@green-goods/shared/commitment-pooling";
import { Alert } from "@green-goods/shared/components/Alert";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import {
  parseVoucherAmount,
  selectAllowanceRaise,
  type VoucherIssuerReserve,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import { useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits } from "viem";
import type { AdminDialogProps } from "@/components/AdminDialog";
import { AdminTextField } from "@/components/AdminTextField";
import { FactValue, VoucherActDialog, WithPerson } from "./VoucherActDialog";
import { voucherCount, voucherSafeNote } from "./voucherPresentation";

export interface VoucherRaiseAllowanceDialogProps {
  /** The reserve whose allowance to raise; the dialog is open while one is set. */
  reserve: VoucherIssuerReserve | null;
  /** The issuer Safe's signature rule, read from the Safe. */
  safe: IssuerSafeThreshold | undefined;
  tone?: AdminDialogProps["tone"];
  onClose: () => void;
  onRaise: (reserve: VoucherIssuerReserve, allowance: bigint) => Promise<void>;
}

/**
 * Raise an allowance (`SIssuer` · Raise allowance): lets the garden's promised
 * rewards draw more from the reserve. It creates no vouchers; the waiting
 * reward is then retried and sent once. It writes to the reserve's allowance,
 * so it carries a plain description and the Safe's signature count.
 */
export function VoucherRaiseAllowanceDialog({
  reserve,
  safe,
  tone,
  onClose,
  onRaise,
}: VoucherRaiseAllowanceDialogProps) {
  const { formatMessage } = useIntl();
  // The field starts at the garden's allowance again plus what waits, as the copy's
  // example does, and keeps what the steward types.
  const [entry, setEntry] = useState<string | null>(null);
  const decimals = reserve?.issuer.decimals ?? 0;
  const count = (units: bigint) => voucherCount(units, decimals);
  const waiting = reserve?.waitingReward ?? null;
  const suggested = reserve ? reserve.allowance.limit + (waiting?.units ?? 0n) : 0n;
  const text = entry ?? formatUnits(suggested, decimals);
  const allowance = parseVoucherAmount(text, decimals);
  const valid =
    reserve !== null && allowance !== null && selectAllowanceRaise(reserve, allowance).valid;

  return (
    <WithPerson address={waiting?.recipient}>
      {(name) => (
        <VoucherActDialog
          open={reserve !== null}
          onClose={() => {
            setEntry(null);
            onClose();
          }}
          tone={tone}
          title={formatMessage(
            {
              id: "cockpit.garden.pool.voucher.raise.title",
              defaultMessage: "Raise the Allowance for {garden}",
            },
            { garden: reserve?.allowance.garden ?? "" }
          )}
          description={
            waiting
              ? formatMessage(
                  {
                    id: "cockpit.garden.pool.voucher.reserve.shortTitle",
                    defaultMessage:
                      "{name}’s reward of {count, plural, one {# voucher} other {# vouchers}} is waiting.",
                  },
                  { name, count: count(waiting.units) }
                )
              : undefined
          }
          confirmLabel={formatMessage({
            id: "cockpit.garden.pool.voucher.raise.confirm",
            defaultMessage: "Raise Allowance",
          })}
          confirmDisabled={!valid}
          act={async () => {
            if (reserve && allowance !== null && valid) await onRaise(reserve, allowance);
          }}
          note={voucherSafeNote(safe, formatMessage)}
        >
          {reserve ? (
            <FactList frame="card">
              <FactRow
                label={formatMessage({
                  id: "cockpit.garden.pool.voucher.fact.allowance",
                  defaultMessage: "Allowance",
                })}
                value={
                  reserve.allowance.left === 0n
                    ? formatMessage(
                        {
                          id: "cockpit.garden.pool.voucher.fact.allowanceUsed",
                          defaultMessage: "{count}, all used",
                        },
                        { count: count(reserve.allowance.limit) }
                      )
                    : formatMessage(
                        {
                          id: "cockpit.garden.pool.voucher.reserve.allowanceLeft",
                          defaultMessage: "{left} left of {of}",
                        },
                        {
                          left: count(reserve.allowance.left),
                          of: count(reserve.allowance.limit),
                        }
                      )
                }
              />
              {waiting ? (
                <FactRow
                  label={formatMessage({
                    id: "cockpit.garden.pool.voucher.fact.waiting",
                    defaultMessage: "Waiting rewards",
                  })}
                  value={
                    <FactValue
                      value={formatMessage(
                        {
                          id: "cockpit.garden.pool.voucher.vouchers",
                          defaultMessage:
                            "{count, plural, one {# {issuer} voucher} other {# {issuer} vouchers}}",
                        },
                        { count: count(waiting.units), issuer: reserve.issuer.name }
                      )}
                      note={formatMessage(
                        {
                          id: "cockpit.garden.pool.voucher.fact.waitingNote",
                          defaultMessage: "{name}, {title}",
                        },
                        { name, title: waiting.title }
                      )}
                    />
                  }
                />
              ) : null}
              <FactRow
                label={formatMessage({
                  id: "cockpit.garden.pool.voucher.reserve.inReserve",
                  defaultMessage: "In reserve",
                })}
                value={count(reserve.inReserve)}
              />
            </FactList>
          ) : null}
          <AdminTextField
            label={formatMessage({
              id: "cockpit.garden.pool.voucher.raise.field",
              defaultMessage: "New allowance",
            })}
            value={text}
            onChange={(event) => setEntry(event.target.value)}
            error={
              valid
                ? undefined
                : formatMessage(
                    {
                      id: "cockpit.garden.pool.voucher.raise.tooLow",
                      defaultMessage: "More than the {left} left now",
                    },
                    { left: count(reserve?.allowance.left ?? 0n) }
                  )
            }
            helperText={formatMessage({
              id: "cockpit.garden.pool.voucher.raise.hint",
              defaultMessage: "Vouchers still come from your reserve",
            })}
            inputProps={{ inputMode: "decimal", autoComplete: "off" }}
          />
          <Alert
            variant="info"
            title={formatMessage({
              id: "cockpit.garden.pool.voucher.raise.noteTitle",
              defaultMessage: "Lets promised rewards be sent",
            })}
          >
            {formatMessage({
              id: "cockpit.garden.pool.voucher.raise.noteBody",
              defaultMessage:
                "It doesn’t create vouchers. Then the waiting reward can be retried, and it’s sent only once.",
            })}
          </Alert>
        </VoucherActDialog>
      )}
    </WithPerson>
  );
}
