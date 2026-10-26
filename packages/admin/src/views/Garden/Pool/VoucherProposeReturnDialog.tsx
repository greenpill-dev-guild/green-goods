import type { IssuerSafeThreshold } from "@green-goods/shared/commitment-pooling";
import { Alert } from "@green-goods/shared/components/Alert";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import {
  parseVoucherAmount,
  selectReturnProposal,
  type VoucherBooking,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import { useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits } from "viem";
import type { AdminDialogProps } from "@/components/AdminDialog";
import { AdminTextField } from "@/components/AdminTextField";
import { FactValue, VoucherActDialog, WithPerson } from "./VoucherActDialog";
import { voucherCount, voucherSafeNote } from "./voucherPresentation";

export interface VoucherProposeReturnDialogProps {
  /** The booking that ended early; the dialog is open while one is set. */
  booking: VoucherBooking | null;
  /** The offer the booking is for. */
  title: string;
  /** The issuer Safe's signature rule, read from the Safe. */
  safe: IssuerSafeThreshold | undefined;
  tone?: AdminDialogProps["tone"];
  onClose: () => void;
  onPropose: (booking: VoucherBooking, refund: bigint) => Promise<void>;
}

/**
 * Propose a return (`SIssuer` · Propose return and Above terms): the issuer
 * sets the most that can come back to the holder, within its published terms.
 * A number above them is refused here (the contract stores only a ceiling), and
 * the split shows what goes back and what is released to the reserve. Nothing
 * moves until the holder approves a split. It writes to the voucher escrow, so
 * it carries a plain description; the Safe's signature count comes from the Safe.
 */
export function VoucherProposeReturnDialog({
  booking,
  title,
  safe,
  tone,
  onClose,
  onPropose,
}: VoucherProposeReturnDialogProps) {
  const { formatMessage } = useIntl();
  // The field starts at the most the terms allow, and keeps what the steward types.
  const [entry, setEntry] = useState<string | null>(null);
  const access = booking?.service.kind === "access" ? booking.service : null;
  const limit = booking?.stage.kind === "ended-early" ? booking.stage.returnLimit : 0n;
  const decimals = booking?.issuer.decimals ?? 0;
  const text = entry ?? formatUnits(limit, decimals);
  const refund = parseVoucherAmount(text, decimals);
  const proposal =
    booking && refund !== null
      ? selectReturnProposal({ voucherUnits: booking.voucherUnits, returnLimit: limit }, refund)
      : null;
  const days = access?.daysUsed ?? 0;
  const limitCount = voucherCount(limit, decimals);
  const release = proposal?.valid ? voucherCount(proposal.release, decimals) : 0;
  const back = proposal?.valid ? voucherCount(proposal.refund, decimals) : 0;

  return (
    <WithPerson address={booking?.holder}>
      {(name) => {
        const releaseLabel = formatMessage(
          {
            id: "cockpit.garden.pool.voucher.split.reserve",
            defaultMessage: "{count} to your reserve",
          },
          { count: release }
        );
        const backLabel = formatMessage(
          {
            id: "cockpit.garden.pool.voucher.split.back",
            defaultMessage: "{count} back to {name}",
          },
          { count: back, name }
        );
        return (
          <VoucherActDialog
            open={booking !== null}
            onClose={() => {
              setEntry(null);
              onClose();
            }}
            tone={tone}
            title={formatMessage(
              {
                id: "cockpit.garden.pool.voucher.propose.title",
                defaultMessage: "Propose a Return to {name}",
              },
              { name }
            )}
            description={formatMessage(
              {
                id: "cockpit.garden.pool.voucher.propose.description",
                defaultMessage:
                  "{title} · stopped after {days, plural, one {# day} other {# days}}",
              },
              { title, days }
            )}
            confirmLabel={formatMessage({
              id: "cockpit.garden.pool.voucher.propose.confirm",
              defaultMessage: "Propose Return",
            })}
            confirmDisabled={!proposal?.valid}
            act={async () => {
              if (booking && proposal?.valid) await onPropose(booking, proposal.refund);
            }}
            note={voucherSafeNote(safe, formatMessage)}
          >
            {booking && access ? (
              <FactList frame="card">
                <FactRow
                  label={formatMessage({
                    id: "cockpit.garden.pool.voucher.fact.vouchers",
                    defaultMessage: "Vouchers",
                  })}
                  value={formatMessage(
                    {
                      id: "cockpit.garden.pool.voucher.vouchers",
                      defaultMessage:
                        "{count, plural, one {# {issuer} voucher} other {# {issuer} vouchers}}",
                    },
                    {
                      count: voucherCount(booking.voucherUnits, decimals),
                      issuer: booking.issuer.name,
                    }
                  )}
                />
                <FactRow
                  label={formatMessage({
                    id: "cockpit.garden.pool.voucher.fact.accessDays",
                    defaultMessage: "Days of access",
                  })}
                  value={
                    <FactValue
                      value={formatMessage(
                        {
                          id: "cockpit.garden.pool.voucher.fact.daysOf",
                          defaultMessage: "{done} of {of}",
                        },
                        { done: access.daysUsed, of: access.daysOf }
                      )}
                      note={formatMessage({
                        id: "cockpit.garden.pool.voucher.fact.asReported",
                        defaultMessage: "As you reported",
                      })}
                    />
                  }
                />
              </FactList>
            ) : null}
            <AdminTextField
              label={formatMessage(
                {
                  id: "cockpit.garden.pool.voucher.propose.field",
                  defaultMessage: "Back to {name}",
                },
                { name }
              )}
              value={text}
              onChange={(event) => setEntry(event.target.value)}
              error={
                proposal?.aboveTerms
                  ? formatMessage(
                      {
                        id: "cockpit.garden.pool.voucher.propose.aboveTerms",
                        defaultMessage:
                          "Above the {limit} your terms allow after {days, plural, one {# day} other {# days}}",
                      },
                      { limit: limitCount, days }
                    )
                  : proposal?.valid
                    ? undefined
                    : formatMessage({
                        id: "cockpit.garden.pool.voucher.propose.invalid",
                        defaultMessage: "Enter how many vouchers go back",
                      })
              }
              helperText={formatMessage(
                {
                  id: "cockpit.garden.pool.voucher.propose.hint",
                  defaultMessage:
                    "Your terms allow up to {limit} after {days, plural, one {# day} other {# days}}",
                },
                { limit: limitCount, days }
              )}
              inputProps={{ inputMode: "decimal", autoComplete: "off" }}
            />
            {proposal?.valid ? (
              <div
                role="img"
                aria-label={`${releaseLabel}, ${backLabel}`}
                className="flex h-8 overflow-hidden rounded-lg border border-stroke-soft type-label-sm"
                data-testid="voucher-return-split"
              >
                {release > 0 ? (
                  <span
                    className="grid min-w-0 place-items-center truncate bg-bg-weak px-2 text-text-strong"
                    style={{ flex: release }}
                  >
                    {releaseLabel}
                  </span>
                ) : null}
                <span
                  className="grid min-w-0 place-items-center truncate bg-information-lighter px-2 text-information-dark"
                  style={{ flex: back }}
                >
                  {backLabel}
                </span>
              </div>
            ) : null}
            <Alert
              variant="info"
              title={formatMessage(
                {
                  id: "cockpit.garden.pool.voucher.propose.noteTitle",
                  defaultMessage: "{name} decides",
                },
                { name }
              )}
            >
              {formatMessage(
                {
                  id: "cockpit.garden.pool.voucher.propose.noteBody",
                  defaultMessage:
                    "Nothing moves until {name} approves a split. You can’t move the vouchers yourself.",
                },
                { name }
              )}
            </Alert>
          </VoucherActDialog>
        );
      }}
    </WithPerson>
  );
}
