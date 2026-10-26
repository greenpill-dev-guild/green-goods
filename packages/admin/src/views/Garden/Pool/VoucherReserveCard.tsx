import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import type {
  VoucherIssuerReserve,
  VoucherIssuerSafe,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import { useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import type { AdminDialogProps } from "@/components/AdminDialog";
import { FactValue, WithPerson } from "./VoucherActDialog";
import { VoucherRaiseAllowanceDialog } from "./VoucherRaiseAllowanceDialog";
import { voucherCount } from "./voucherPresentation";

export interface VoucherReserveCardProps {
  reserve: VoucherIssuerReserve;
  safe: VoucherIssuerSafe;
  /** Offline, or another act is with the wallet or the chain. */
  disabled: boolean;
  tone?: AdminDialogProps["tone"];
  onRaiseAllowance: (reserve: VoucherIssuerReserve, allowance: bigint) => Promise<void>;
}

/**
 * Your Reserve (`SIssuer`), in the rail of an issuing garden's Promises tab:
 * the vouchers its promised rewards draw on, kept apart from bookings, the
 * funding garden's allowance, the service terms, and the issuer's published
 * cap. When the allowance can't cover a promised reward, the reward waits (it
 * isn't lost) and Raise Allowance… repairs it; the Safe's signature count
 * comes from the Safe.
 */
export function VoucherReserveCard({
  reserve,
  safe,
  disabled,
  tone,
  onRaiseAllowance,
}: VoucherReserveCardProps) {
  const { formatMessage } = useIntl();
  const [raising, setRaising] = useState(false);
  const raiseButtonRef = useRef<HTMLButtonElement>(null);
  const { issuer, allowance, terms, cap, waitingReward } = reserve;
  const count = (units: bigint) => voucherCount(units, issuer.decimals);
  const vouchers = (units: bigint) =>
    formatMessage(
      {
        id: "cockpit.garden.pool.voucher.vouchers",
        defaultMessage: "{count, plural, one {# {issuer} voucher} other {# {issuer} vouchers}}",
      },
      { count: count(units), issuer: issuer.name }
    );
  const short = waitingReward !== null && allowance.left < waitingReward.units;

  return (
    <AdminCard
      variant="elevated"
      data-component="VoucherReserveCard"
      data-testid="voucher-reserve"
      className="space-y-3"
    >
      <div>
        <AdminCardTitle>
          {formatMessage({
            id: "cockpit.garden.pool.voucher.reserve.title",
            defaultMessage: "Your Reserve",
          })}
        </AdminCardTitle>
        <p className="mt-1 type-meta text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.voucher.reserve.description",
            defaultMessage: "Vouchers you can send as rewards, kept apart from bookings",
          })}
        </p>
      </div>
      <FactList frame="inset">
        <FactRow
          label={formatMessage({
            id: "cockpit.garden.pool.voucher.reserve.inReserve",
            defaultMessage: "In reserve",
          })}
          value={vouchers(reserve.inReserve)}
        />
        <FactRow
          label={formatMessage({
            id: "cockpit.garden.pool.voucher.reserve.promised",
            defaultMessage: "Promised as rewards, not yet sent",
          })}
          value={
            <FactValue
              value={count(reserve.promised)}
              note={formatMessage(
                {
                  id: "cockpit.garden.pool.voucher.reserve.promisedTo",
                  defaultMessage: "{garden} members",
                },
                { garden: allowance.garden }
              )}
            />
          }
        />
        <FactRow
          label={formatMessage(
            {
              id: "cockpit.garden.pool.voucher.reserve.allowance",
              defaultMessage: "Allowance for {garden}",
            },
            { garden: allowance.garden }
          )}
          value={
            <FactValue
              value={formatMessage(
                {
                  id: "cockpit.garden.pool.voucher.reserve.allowanceLeft",
                  defaultMessage: "{left} left of {of}",
                },
                { left: count(allowance.left), of: count(allowance.limit) }
              )}
              note={formatMessage({
                id: "cockpit.garden.pool.voucher.reserve.allowanceNote",
                defaultMessage: "What their promised rewards can draw",
              })}
            />
          }
        />
        <FactRow
          label={formatMessage({
            id: "cockpit.garden.pool.voucher.reserve.openBookings",
            defaultMessage: "Open bookings",
          })}
          value={
            <FactValue
              value={reserve.openBookings}
              note={formatMessage({
                id: "cockpit.garden.pool.voucher.reserve.openNote",
                defaultMessage: "Service you owe",
              })}
            />
          }
        />
        <FactRow
          label={formatMessage({
            id: "cockpit.garden.pool.voucher.reserve.terms",
            defaultMessage: "Service terms",
          })}
          value={
            <FactValue
              value={formatMessage(
                { id: "cockpit.garden.pool.voucher.version", defaultMessage: "Version {version}" },
                { version: terms.version.toString() }
              )}
              note={
                terms.returns.kind === "usable-hours"
                  ? formatMessage(
                      {
                        id: "cockpit.garden.pool.voucher.reserve.returnsByHours",
                        defaultMessage: "Returns by usable time, out of {hours} hours",
                      },
                      { hours: terms.returns.of }
                    )
                  : formatMessage(
                      {
                        id: "cockpit.garden.pool.voucher.reserve.returnsByDays",
                        defaultMessage: "Returns by days of access, out of {days}",
                      },
                      { days: terms.returns.of }
                    )
              }
            />
          }
        />
        <FactRow
          label={formatMessage({
            id: "cockpit.garden.pool.voucher.reserve.approvals",
            defaultMessage: "Approvals",
          })}
          value={
            <FactValue
              value={formatMessage({
                id: "cockpit.garden.pool.voucher.reserve.eachBooking",
                defaultMessage: "Each booking",
              })}
              note={
                safe.status === "observed"
                  ? formatMessage(
                      {
                        id: "cockpit.garden.pool.voucher.reserve.safeSigns",
                        defaultMessage:
                          "{threshold, plural, one {Your Safe signs each one, # signature} other {Your Safe signs each one, # of {owners} signatures}}",
                      },
                      { threshold: safe.threshold, owners: safe.owners }
                    )
                  : formatMessage({
                      id: "cockpit.garden.pool.voucher.reserve.safeSignsUnread",
                      defaultMessage: "Your Safe signs each one",
                    })
              }
            />
          }
        />
        <FactRow
          label={formatMessage({
            id: "cockpit.garden.pool.voucher.reserve.cap",
            defaultMessage: "Issuer cap",
          })}
          value={
            <FactValue
              value={formatMessage(
                {
                  id: "cockpit.garden.pool.voucher.reserve.capValue",
                  defaultMessage: "{issued} of {ceiling}",
                },
                { issued: count(cap.issued), ceiling: count(cap.ceiling) }
              )}
              note={formatMessage({
                id: "cockpit.garden.pool.voucher.reserve.capNote",
                defaultMessage: "Published policy, monitored. Not enforced yet.",
              })}
            />
          }
        />
      </FactList>
      {short && waitingReward ? (
        <WithPerson address={waitingReward.recipient}>
          {(name) => (
            <Alert
              variant="warning"
              title={formatMessage(
                {
                  id: "cockpit.garden.pool.voucher.reserve.shortTitle",
                  defaultMessage:
                    "{name}’s reward of {count, plural, one {# voucher} other {# vouchers}} is waiting.",
                },
                { name, count: count(waitingReward.units) }
              )}
              action={
                <Button
                  ref={raiseButtonRef}
                  type="button"
                  emphasis="primary"
                  size="compact"
                  onClick={() => setRaising(true)}
                  disabled={disabled}
                >
                  {formatMessage({
                    id: "cockpit.garden.pool.voucher.act.raise",
                    defaultMessage: "Raise Allowance…",
                  })}
                </Button>
              }
            >
              {formatMessage(
                {
                  id: "cockpit.garden.pool.voucher.reserve.shortBody",
                  defaultMessage:
                    "The allowance for {garden} is used up. Raise it so the reward can be sent. Promised rewards don’t set vouchers aside.",
                },
                { garden: allowance.garden }
              )}
            </Alert>
          )}
        </WithPerson>
      ) : null}
      <VoucherRaiseAllowanceDialog
        reserve={raising ? reserve : null}
        safe={safe}
        tone={tone}
        onClose={() => {
          setRaising(false);
          raiseButtonRef.current?.focus();
        }}
        onRaise={onRaiseAllowance}
      />
    </AdminCard>
  );
}
