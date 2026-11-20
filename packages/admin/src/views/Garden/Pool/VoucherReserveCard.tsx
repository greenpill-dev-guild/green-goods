import { SERVICE_ISSUER_ROUTES } from "@green-goods/shared/commitment-pooling";
import { VoucherAwardDesk } from "./VoucherAwardDesk";
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { StatTile } from "@green-goods/shared/components/Cards/StatTile";
import type {
  IssuerSafeThreshold,
  VoucherIssuerReserve,
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
  /** The issuer Safe's signature rule, read from the Safe. */
  safe: IssuerSafeThreshold | undefined;
  /** Offline, or another act is with the wallet or the chain. */
  disabled: boolean;
  tone?: AdminDialogProps["tone"];
  onRaiseAllowance: (reserve: VoucherIssuerReserve, allowance: bigint) => Promise<void>;
}

/**
 * Your Reserve (`SIssuer`), in the rail of an issuing garden's Promises tab. It
 * leads with three numbers (decision 3 of the 18 November 2026 hub-day review):
 * the vouchers in reserve, kept apart from bookings, the rewards promised from
 * them and not yet sent, and the bookings open. The funding garden's allowance,
 * the service terms, how bookings are approved and the issuer's published cap
 * fold under Reserve details. When the allowance can't cover a promised reward,
 * the reward waits (it isn't lost), the card says whether the allowance is used
 * up or only short of it, and Raise Allowance… repairs it; the Safe's signature
 * count comes from the Safe.
 */
export function VoucherReserveCard({
  reserve,
  safe,
  disabled,
  tone,
  onRaiseAllowance,
}: VoucherReserveCardProps) {
  const { formatMessage } = useIntl();
  const [awarding, setAwarding] = useState(false);
  const awardButtonRef = useRef<HTMLButtonElement>(null);
  const awardAvailable =
    reserve.issuer.chainId === 100 &&
    SERVICE_ISSUER_ROUTES.some((route) =>
      route.assets.some(
        (asset) => asset.ownerReserve.toLowerCase() === reserve.issuer.safe.toLowerCase()
      )
    );
  const [raising, setRaising] = useState(false);
  const raiseButtonRef = useRef<HTMLButtonElement>(null);
  const { issuer, allowance, terms, cap, waitingReward } = reserve;
  const count = (units: bigint) => voucherCount(units, issuer.decimals);
  const short = waitingReward !== null && allowance.left < waitingReward.units;

  return (
    <AdminCard
      variant="elevated"
      data-component="VoucherReserveCard"
      data-testid="voucher-reserve"
      className="space-y-3"
    >
      {/* The card's one act sits in its header slot, where the eye lands before the facts. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <AdminCardTitle>
            {formatMessage({
              id: "hub.garden.pool.voucher.reserve.title",
              defaultMessage: "Your Reserve",
            })}
          </AdminCardTitle>
          <p className="mt-1 type-meta text-text-soft">
            {awardAvailable
              ? formatMessage({
                  id: "hub.garden.pool.voucher.reserve.descriptionAwards",
                  defaultMessage:
                    "Vouchers you can send as rewards or award for past work, kept apart from bookings",
                })
              : formatMessage({
                  id: "hub.garden.pool.voucher.reserve.description",
                  defaultMessage: "Vouchers you can send as rewards, kept apart from bookings",
                })}
          </p>
        </div>
        {awardAvailable ? (
          <Button
            ref={awardButtonRef}
            type="button"
            emphasis="secondary"
            size="sm"
            className="shrink-0"
            disabled={disabled}
            onClick={() => setAwarding(true)}
          >
            {formatMessage({ id: "hub.voucherAward.title" })}
          </Button>
        ) : null}
      </div>
      {/* Bottom-aligned, so the values stay level if a label wraps in a narrow tile. */}
      <div className="grid grid-cols-3 items-end gap-3">
        {(
          [
            [
              formatMessage({
                id: "hub.garden.pool.voucher.reserve.inReserve",
                defaultMessage: "In reserve",
              }),
              count(reserve.inReserve),
            ],
            [
              formatMessage({
                id: "hub.garden.pool.voucher.reserve.promisedShort",
                defaultMessage: "Promised",
              }),
              count(reserve.promised),
            ],
            [
              formatMessage({
                id: "hub.garden.pool.voucher.reserve.booked",
                defaultMessage: "Booked",
              }),
              reserve.openBookings,
            ],
          ] as const
        ).map(([label, value]) => (
          <StatTile key={label} label={label} value={value} data-testid="voucher-reserve-stat" />
        ))}
      </div>
      <details className="rounded-(--gg-row-radius) border border-stroke-soft">
        <summary className="flex min-h-11 cursor-pointer items-center px-3 type-label text-text-sub">
          {formatMessage({
            id: "hub.garden.pool.voucher.reserve.details",
            defaultMessage: "Reserve details",
          })}
        </summary>
        <div className="px-3 pb-3">
          <FactList frame="inset">
            <FactRow
              label={formatMessage(
                {
                  id: "hub.garden.pool.voucher.reserve.allowance",
                  defaultMessage: "Allowance for {garden}",
                },
                { garden: allowance.garden }
              )}
              value={
                <FactValue
                  value={formatMessage(
                    {
                      id: "hub.garden.pool.voucher.reserve.allowanceLeft",
                      defaultMessage: "{left} left of {of}",
                    },
                    { left: count(allowance.left), of: count(allowance.limit) }
                  )}
                  note={formatMessage({
                    id: "hub.garden.pool.voucher.reserve.allowanceNote",
                    defaultMessage: "What their promised rewards can draw",
                  })}
                />
              }
            />
            <FactRow
              label={formatMessage({
                id: "hub.garden.pool.voucher.reserve.terms",
                defaultMessage: "Service terms",
              })}
              value={
                <FactValue
                  value={formatMessage(
                    { id: "hub.garden.pool.voucher.version", defaultMessage: "Version {version}" },
                    { version: terms.version.toString() }
                  )}
                  note={
                    terms.returns.kind === "usable-hours"
                      ? formatMessage(
                          {
                            id: "hub.garden.pool.voucher.reserve.returnsByHours",
                            defaultMessage: "Returns by usable time, out of {hours} hours",
                          },
                          { hours: terms.returns.of }
                        )
                      : formatMessage(
                          {
                            id: "hub.garden.pool.voucher.reserve.returnsByDays",
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
                id: "hub.garden.pool.voucher.reserve.approvals",
                defaultMessage: "Approvals",
              })}
              value={
                <FactValue
                  value={formatMessage({
                    id: "hub.garden.pool.voucher.reserve.eachBooking",
                    defaultMessage: "Each booking",
                  })}
                  note={
                    safe?.status === "observed" && safe.threshold !== null && safe.owners !== null
                      ? formatMessage(
                          {
                            id: "hub.garden.pool.voucher.reserve.safeSigns",
                            defaultMessage:
                              "{threshold, plural, one {Your Safe signs each one, # signature} other {Your Safe signs each one, # of {owners} signatures}}",
                          },
                          { threshold: safe.threshold, owners: safe.owners }
                        )
                      : formatMessage({
                          id: "hub.garden.pool.voucher.reserve.safeSignsUnread",
                          defaultMessage: "Your Safe signs each one",
                        })
                  }
                />
              }
            />
            <FactRow
              label={formatMessage({
                id: "hub.garden.pool.voucher.reserve.cap",
                defaultMessage: "Issuer cap",
              })}
              value={
                <FactValue
                  value={formatMessage(
                    {
                      id: "hub.garden.pool.voucher.reserve.capValue",
                      defaultMessage: "{issued} of {ceiling}",
                    },
                    { issued: count(cap.issued), ceiling: count(cap.ceiling) }
                  )}
                  note={formatMessage({
                    id: "hub.garden.pool.voucher.reserve.capNote",
                    defaultMessage: "Published policy, monitored. Not enforced yet.",
                  })}
                />
              }
            />
          </FactList>
        </div>
      </details>
      {short && waitingReward ? (
        <WithPerson address={waitingReward.recipient}>
          {(name) => (
            <Alert
              variant="warning"
              title={formatMessage(
                {
                  id: "hub.garden.pool.voucher.reserve.shortTitle",
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
                    id: "hub.garden.pool.voucher.act.raise",
                    defaultMessage: "Raise Allowance…",
                  })}
                </Button>
              }
            >
              {allowance.left === 0n
                ? formatMessage(
                    {
                      id: "hub.garden.pool.voucher.reserve.shortBody",
                      defaultMessage:
                        "The allowance for {garden} is used up. Raise it so the reward can be sent. Promised rewards don’t set vouchers aside.",
                    },
                    { garden: allowance.garden }
                  )
                : formatMessage(
                    {
                      id: "hub.garden.pool.voucher.reserve.shortBodyLeft",
                      defaultMessage:
                        "The allowance for {garden} has {left} left, less than the reward needs. Raise it so the reward can be sent. Promised rewards don’t set vouchers aside.",
                    },
                    { garden: allowance.garden, left: count(allowance.left) }
                  )}
            </Alert>
          )}
        </WithPerson>
      ) : null}
      {awarding ? (
        <VoucherAwardDesk
          reserve={reserve}
          disabled={disabled}
          onClose={() => {
            setAwarding(false);
            awardButtonRef.current?.focus();
          }}
        />
      ) : null}
      <VoucherRaiseAllowanceDialog
        reserve={raising ? reserve : null}
        safe={safe}
        disabled={disabled}
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
