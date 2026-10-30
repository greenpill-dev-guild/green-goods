import {
  type VoucherAcceptanceChecks as Checks,
  selectVoucherAskStage,
  type VoucherAsk,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiCheckLine, RiCloseLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { dayText, dueDateText } from "./poolTime";
import { voucherCount } from "./voucherPresentation";

const CHECK_ORDER = ["consent", "approval", "deposit", "deadline"] as const;

/**
 * The four things a voucher booking's acceptance needs (`acceptServiceClaim`):
 * the member's current consent, the issuer's approval (its Safe's, or a member
 * issuer's from their own account), the confirmed deposit and the deadline,
 * each with whether it holds now, by its mark and its words, never by color alone.
 */
export function VoucherAcceptanceChecks({
  ask,
  name,
  checks,
  nowMs,
}: {
  ask: VoucherAsk;
  name: string;
  checks: Checks;
  nowMs: number;
}) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const { setup } = ask;
  // Consent fails two ways: the offer's terms moved, or the ask names no agreement at all.
  const stage = selectVoucherAskStage(ask, nowMs / 1000);
  const approvedAt = setup ? setup.approvedAt : null;
  const count = voucherCount(setup?.voucherUnits ?? 0n, ask.issuer.decimals);
  // A member issuer sets their own terms and approves from their own account, so the checks name them.
  const member = ask.issuer.kind === "individual" ? ask.issuer.name : null;
  const line = {
    consent: {
      title: member
        ? formatMessage(
            {
              id: "cockpit.garden.pool.voucher.check.consentMember",
              defaultMessage: "{name} agreed to {issuer}’s current terms",
            },
            { name, issuer: member }
          )
        : formatMessage(
            {
              id: "cockpit.garden.pool.voucher.check.consent",
              defaultMessage: "{name} agreed to the current terms",
            },
            { name }
          ),
      note: checks.consent
        ? formatMessage(
            { id: "cockpit.garden.pool.voucher.version", defaultMessage: "Version {version}" },
            { version: ask.agreed.revision.toString() }
          )
        : stage === "terms-changed"
          ? formatMessage(
              {
                id: "cockpit.garden.pool.voucher.check.consentFailed",
                defaultMessage: "The terms changed after {name} agreed, so they book again",
              },
              { name }
            )
          : formatMessage(
              {
                id: "cockpit.garden.pool.voucher.check.consentMissing",
                defaultMessage: "There’s no agreement from {name} to accept, so they book again",
              },
              { name }
            ),
    },
    approval: {
      title: member
        ? formatMessage(
            {
              id: "cockpit.garden.pool.voucher.check.approvalMember",
              defaultMessage: "{issuer} approved the booking from their account",
            },
            { issuer: member }
          )
        : formatMessage({
            id: "cockpit.garden.pool.voucher.check.approval",
            defaultMessage: "Your Safe approved the booking",
          }),
      note:
        approvedAt !== null
          ? dayText(intl, approvedAt * 1000, nowMs)
          : formatMessage({
              id: "cockpit.garden.pool.voucher.check.approvalMissing",
              defaultMessage: "Not approved yet",
            }),
    },
    deposit: {
      title: member
        ? formatMessage(
            {
              id: "cockpit.garden.pool.voucher.check.depositMember",
              defaultMessage:
                "{count, plural, one {# {issuer} voucher} other {# {issuer} vouchers}} deposited in escrow",
            },
            { count, issuer: member }
          )
        : formatMessage(
            {
              id: "cockpit.garden.pool.voucher.check.deposit",
              defaultMessage:
                "{count, plural, one {# voucher} other {# vouchers}} deposited in escrow",
            },
            { count }
          ),
      note: checks.deposit
        ? formatMessage({
            id: "cockpit.garden.pool.voucher.check.depositConfirmed",
            defaultMessage: "Confirmed on Green Goods",
          })
        : formatMessage({
            id: "cockpit.garden.pool.voucher.check.depositMissing",
            defaultMessage: "Not confirmed on Green Goods yet",
          }),
    },
    deadline: {
      title: formatMessage({
        id: "cockpit.garden.pool.voucher.check.deadline",
        defaultMessage: "Before the deadline",
      }),
      note: setup
        ? checks.deadline
          ? dueDateText(intl, setup.acceptBy * 1000, nowMs)
          : formatMessage(
              {
                id: "cockpit.garden.pool.voucher.check.deadlinePassed",
                defaultMessage: "It passed {date}",
              },
              { date: dayText(intl, setup.acceptBy * 1000, nowMs) }
            )
        : null,
    },
  };
  return (
    <ul className="space-y-3" data-testid="voucher-acceptance-checks">
      {CHECK_ORDER.map((key) => {
        const holds = checks[key];
        const Icon = holds ? RiCheckLine : RiCloseLine;
        return (
          <li key={key} className="flex items-start gap-3" data-check={key} data-holds={holds}>
            <span
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                holds ? "bg-success-lighter text-success-dark" : "bg-error-lighter text-error-dark"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block type-body text-text-strong">{line[key].title}</span>
              {line[key].note ? (
                <span
                  className={cn("block type-meta", holds ? "text-text-soft" : "text-error-dark")}
                >
                  {line[key].note}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
