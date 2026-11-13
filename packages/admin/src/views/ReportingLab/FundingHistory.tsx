/**
 * Garden reporting lab, interface 7: funding history. Each asset keeps its own balances
 * and its own chart; a deposit, a yield share, a claim and an allocation are different
 * kinds of entry, and an allocation moves nothing. There is no total in one currency, no
 * runway, and no line from a payment to a piece of work, because none of that is recorded.
 */
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { StatTile } from "@green-goods/shared/components/Cards/StatTile";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiDraftLine,
  RiErrorWarningLine,
  RiWallet3Line,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { dayKeyOf, formatDay, formatMonth, monthOf } from "./dates";
import { type AccountBalance, directionOf, formatAmount, fundingSummary } from "./funding";
import { plural } from "./labCopy";
import type { LedgerEntry, ReportDataset } from "./model";
import { periodEnd, type ReportScope, closingDay } from "./scope";

interface FundingHistoryProps {
  dataset: ReportDataset;
  scope: ReportScope;
}

const KIND_COPY: Record<LedgerEntry["kind"], string> = {
  deposit: "Deposit",
  "top-up": "Deposit",
  yield: "Yield share",
  claim: "Claim",
  allocation: "Allocation (plan)",
};

/** A step line of one account's balance; its numbers are on the row beside it. */
function Steps({ account, start, end }: { account: AccountBalance; start: number; end: number }) {
  const peak = Math.max(...account.points.map((p) => p.balance), 1);
  const x = (on: number) => ((on - start) / Math.max(end - start, 1)) * 100;
  const y = (balance: number) => 28 - (balance / peak) * 26;
  let d = `M 0 28`;
  for (const point of account.points) d += ` H ${x(point.on)} V ${y(point.balance)}`;
  d += ` H 100`;
  return (
    <svg aria-hidden viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full">
      <path
        d={d}
        fill="none"
        vectorEffect="non-scaling-stroke"
        className="stroke-information-dark"
        strokeWidth={1.5}
      />
    </svg>
  );
}

export function FundingHistory({ dataset, scope }: FundingHistoryProps) {
  const { locale } = useIntl();
  const { garden } = dataset;
  const at = periodEnd(scope.month, dataset);
  const summary = fundingSummary(garden, at, scope.month);
  const monthLabel = formatMonth(scope.month, locale);
  const asOf = formatDay(closingDay(at, dataset), locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const first = summary.entries[summary.entries.length - 1]?.on ?? at;
  const day = (on: number) =>
    formatDay(dayKeyOf(on, garden.timeZone), locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  if (summary.entries.length === 0) {
    return (
      <AdminCard>
        <EmptyState
          icon={<RiWallet3Line className="h-6 w-6" />}
          title="No funding recorded"
          description="Deposits, yield and claims appear here once the garden's vaults or cookie jar hold anything."
        />
      </AdminCard>
    );
  }

  const entryRow = (entry: LedgerEntry) => {
    const direction = directionOf(entry);
    let pill = {
      label: direction === "in" ? "In" : direction === "out" ? "Out" : "Plan",
      tone:
        direction === "in"
          ? ("success" as const)
          : direction === "out"
            ? ("warning" as const)
            : ("info" as const),
    };
    if (!entry.readable) pill = { label: "Could not read", tone: "warning" as const };
    let icon = <RiDraftLine className="h-6 w-6" />;
    if (direction === "in") icon = <RiArrowDownLine className="h-6 w-6" />;
    else if (direction === "out") icon = <RiArrowUpLine className="h-6 w-6" />;
    if (!entry.readable) icon = <RiErrorWarningLine className="h-6 w-6" />;
    return (
      <li key={entry.id}>
        <ItemRow
          lead={{ kind: "icon", icon }}
          title={`${KIND_COPY[entry.kind]}: ${entry.counterparty}`}
          status={pill}
          details={[entry.accountLabel, { text: day(entry.on), tone: "soft" }]}
          amount={{
            value: entry.readable
              ? `${direction === "out" ? "-" : direction === "in" ? "+" : ""}${formatAmount(entry.amount, entry.asset, locale)}`
              : "Unread",
            caption: KIND_COPY[entry.kind],
          }}
        />
      </li>
    );
  };

  const inMonth = summary.entries.filter(
    (e) => monthOf(dayKeyOf(e.on, garden.timeZone)) === scope.month
  );
  const earlier = summary.entries.filter(
    (e) => monthOf(dayKeyOf(e.on, garden.timeZone)) < scope.month
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-5" data-component="FundingHistory">
      <AdminCard density="none">
        <AdminCardHeader>
          <div className="min-w-0">
            <AdminCardTitle as="h2">Balances as of {asOf}</AdminCardTitle>
            <p className="mt-1 type-body text-text-sub">
              Each asset stands alone: no exchange rates, no single total, no runway estimate.
            </p>
          </div>
        </AdminCardHeader>
        <AdminCardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {summary.assets.map((asset) => (
            <section key={asset.asset} className="flex flex-col gap-3">
              <h3 className="type-label font-semibold text-text-strong">{asset.asset}</h3>
              {asset.accounts.map((account) => (
                <div
                  key={account.label}
                  className="flex flex-col gap-1 rounded-(--admin-radius-lg) border border-stroke-soft p-3"
                >
                  <StatTile
                    label={account.label}
                    value={formatAmount(account.balance, asset.asset, locale)}
                    delta={
                      account.account === "endowment"
                        ? "principal; the funders hold its shares"
                        : "available to claim within its limits"
                    }
                  />
                  <Steps account={account} start={first} end={at} />
                </div>
              ))}
              <p className="type-meta text-text-sub">
                {monthLabel}: {formatAmount(asset.inflow, asset.asset, locale)} in,{" "}
                {formatAmount(asset.outflow, asset.asset, locale)} out
                {asset.allocated > 0
                  ? `, ${formatAmount(asset.allocated, asset.asset, locale)} allocated as a plan`
                  : ""}
                .
              </p>
            </section>
          ))}
        </AdminCardBody>
      </AdminCard>

      <AdminCard density="none">
        <AdminCardHeader>
          <div className="min-w-0">
            <AdminCardTitle as="h2">Ledger</AdminCardTitle>
            <p className="mt-1 type-body text-text-sub">
              Approving work does not pay anyone; each garden decides rewards separately. Claims do
              not name the work they pay for.
            </p>
          </div>
        </AdminCardHeader>
        <AdminCardBody className="flex flex-col gap-4">
          {summary.unreadable > 0 ? (
            <p className="type-meta text-warning-dark">
              {summary.unreadable}{" "}
              {plural(
                summary.unreadable,
                "entry could not be read and counts",
                "entries could not be read and count"
              )}{" "}
              in no balance above.
            </p>
          ) : null}
          <section className="flex flex-col gap-2">
            <h3 className="type-label font-semibold text-text-strong">{monthLabel}</h3>
            {inMonth.length === 0 ? (
              <p className="type-meta text-text-sub">No entries this month.</p>
            ) : (
              <ul className="flex flex-col gap-(--gg-list-gap)">{inMonth.map(entryRow)}</ul>
            )}
          </section>
          {earlier.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="type-label font-semibold text-text-strong">Earlier</h3>
              <ul className="flex flex-col gap-(--gg-list-gap)">{earlier.map(entryRow)}</ul>
            </section>
          ) : null}
          <p className="type-meta text-text-soft">
            {
              "A deposit into a vault stays there as principal. A yield share is the cookie jar's part of a vault harvest; the rest goes to impact certificate purchases and the protocol treasury. An allocation is a plan and moves no balance."
            }
          </p>
        </AdminCardBody>
      </AdminCard>
    </div>
  );
}
