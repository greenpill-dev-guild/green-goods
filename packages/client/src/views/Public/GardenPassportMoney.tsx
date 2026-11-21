import type {
  PassportMoneyLine,
  PassportPaymentCounts,
  PassportSection,
  PassportSettlement,
} from "@green-goods/shared/commitment-pooling/public";
import { type IntlShape, useIntl } from "react-intl";
import {
  PassportFigure,
  PassportFreshness,
  PassportLine,
  PassportNote,
  PassportNothingYet,
  PassportSource,
  PassportUnavailable,
  PassportUnitRows,
} from "./GardenPassportAtoms";
import { passportAmount, passportMoneyToken } from "./gardenPassportFormat";
import { Section } from "./GardenDetailSections";

/**
 * `§ 02 G$ payments` on the passport: what was declared beside what was recorded, sent,
 * confirmed, failed or canceled. A declared amount is intent, a recorded payment has not been
 * sent, and a sent one has not arrived. Only a confirmed arrival is money received, and none of
 * these is ever shown as another. Amounts stay in G$ and are not converted.
 */

type Outcome = keyof PassportPaymentCounts;

function outcomeLabels(intl: IntlShape): Record<Outcome, string> {
  const { formatMessage } = intl;
  return {
    confirmed: formatMessage({
      id: "public.passport.money.confirmed",
      defaultMessage: "Confirmed as arrived",
    }),
    sent: formatMessage({
      id: "public.passport.money.awaiting",
      defaultMessage: "Sent, not yet confirmed",
    }),
    queued: formatMessage({
      id: "public.passport.money.queued",
      defaultMessage: "Recorded, not yet sent",
    }),
    failed: formatMessage({
      id: "public.passport.money.failed",
      defaultMessage: "Sent and did not arrive",
    }),
    cancelled: formatMessage({
      id: "public.passport.money.cancelled",
      defaultMessage: "Canceled",
    }),
  };
}

const OUTCOMES: readonly Outcome[] = ["confirmed", "sent", "queued", "failed", "cancelled"];

/** One token's payments by outcome, each as its own row. An unnamed token keeps no figure. */
function amountRows(intl: IntlShape, line: PassportMoneyLine) {
  const token = passportMoneyToken(line.token);
  if (!token) return [];
  const labels = outcomeLabels(intl);
  return OUTCOMES.map((result) => ({
    unitLabel: labels[result],
    value: `${passportAmount(intl, line[result], token.decimals)} ${token.symbol}`,
  }));
}

/** How many payments ended in each state, where the amounts themselves are held back. */
function countRows(intl: IntlShape, payments: PassportPaymentCounts) {
  const labels = outcomeLabels(intl);
  return OUTCOMES.map((result) => ({
    unitLabel: labels[result],
    value: intl.formatMessage(
      { id: "public.passport.money.paymentCount" },
      { count: payments[result] }
    ),
  }));
}

export function PassportMoneySection({
  settlement,
  onRetry,
}: {
  settlement: PassportSection<PassportSettlement>;
  onRetry: () => void;
}) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const meta =
    settlement.status === "available" ? <PassportFreshness asOf={settlement.asOf} /> : null;
  const value = settlement.status === "available" ? settlement.value : null;
  const byOutcome = formatMessage({
    id: "public.passport.money.byOutcome",
    defaultMessage: "By outcome",
  });
  return (
    <Section
      id="public-passport-money"
      kicker={formatMessage({
        id: "public.passport.money.kicker",
        defaultMessage: "§ 02: G$ payments",
      })}
      heading={formatMessage({
        id: "public.passport.money.heading",
        defaultMessage: "G$ sent and received",
      })}
      helper={formatMessage({ id: "public.passport.money.helper" })}
    >
      <div className="border-b border-stroke-soft-200">
        <PassportLine
          id="passport-money-support"
          label={formatMessage({
            id: "public.passport.money.support.label",
            defaultMessage: "Support received",
          })}
          meta={meta}
        >
          {!value ? (
            <PassportUnavailable onRetry={onRetry} />
          ) : value.support.lines.length === 0 ? (
            <PassportNothingYet>
              {formatMessage({
                id: "public.passport.money.support.none",
                defaultMessage: "No G$ has been sent to this garden yet.",
              })}
            </PassportNothingYet>
          ) : (
            <>
              <PassportFigure>
                {formatMessage(
                  { id: "public.passport.money.support.figure" },
                  { count: value.support.payments.confirmed }
                )}
              </PassportFigure>
              {value.support.lines.map((line) => (
                <PassportUnitRows
                  key={line.token}
                  label={byOutcome}
                  rows={amountRows(intl, line)}
                />
              ))}
              <PassportSource>
                <p>{formatMessage({ id: "public.passport.supported.source" })}</p>
              </PassportSource>
            </>
          )}
        </PassportLine>

        <PassportLine
          id="passport-money-members"
          label={formatMessage({
            id: "public.passport.money.members.label",
            defaultMessage: "Paid to members",
          })}
          meta={meta}
        >
          {!value ? (
            <PassportUnavailable onRetry={onRetry} />
          ) : (
            <MemberPayments settlement={value} />
          )}
        </PassportLine>
      </div>
    </Section>
  );
}

function MemberPayments({ settlement }: { settlement: PassportSettlement }) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const group = settlement.memberPayments;
  // A promise kept with its payment only declared is the gap a funder most needs to see.
  const waitingForPlan =
    settlement.keptAwaitingPaymentPlan > 0 ? (
      <PassportNote>
        {formatMessage(
          { id: "public.passport.money.members.noPlan" },
          { count: settlement.keptAwaitingPaymentPlan }
        )}
      </PassportNote>
    ) : null;
  if (group.withheld) {
    return (
      <>
        <PassportNote>
          {formatMessage({ id: "public.passport.money.members.withheld" })}
        </PassportNote>
        {waitingForPlan}
      </>
    );
  }
  const paymentsOnRecord = OUTCOMES.reduce((sum, result) => sum + group.payments[result], 0);
  if (group.plans === 0 && paymentsOnRecord === 0) {
    return (
      <>
        <PassportNothingYet>
          {formatMessage({
            id: "public.passport.money.members.none",
            defaultMessage: "No payment to members is on record yet.",
          })}
        </PassportNothingYet>
        {waitingForPlan}
      </>
    );
  }
  const byOutcome = formatMessage({
    id: "public.passport.money.byOutcome",
    defaultMessage: "By outcome",
  });
  const confirmedByToken = new Map((group.lines ?? []).map((line) => [line.token, line.confirmed]));
  // What the plans declare, in the tokens the page can name. Where the amounts by outcome are
  // published, the part not yet confirmed is shown; where they are held back, the whole is.
  const declaredRows = group.declared.flatMap((line) => {
    const token = passportMoneyToken(line.token);
    if (!token) return [];
    const confirmed = confirmedByToken.get(line.token) ?? 0n;
    const unpaid = line.amount > confirmed ? line.amount - confirmed : 0n;
    return [
      {
        unitLabel: group.lines
          ? formatMessage({
              id: "public.passport.money.declared",
              defaultMessage: "Declared, not yet paid",
            })
          : formatMessage({
              id: "public.passport.money.declaredTotal",
              defaultMessage: "Declared in payment plans",
            }),
        value: `${passportAmount(intl, group.lines ? unpaid : line.amount, token.decimals)} ${token.symbol}`,
      },
    ];
  });
  return (
    <>
      <PassportFigure>
        {formatMessage(
          { id: "public.passport.money.members.figure" },
          { count: group.payments.confirmed }
        )}
      </PassportFigure>
      <PassportUnitRows
        label={formatMessage({
          id: "public.passport.money.declaredLabel",
          defaultMessage: "Declared",
        })}
        rows={declaredRows}
      />
      {group.lines ? (
        group.lines.map((line) => (
          <PassportUnitRows key={line.token} label={byOutcome} rows={amountRows(intl, line)} />
        ))
      ) : (
        <>
          <PassportUnitRows label={byOutcome} rows={countRows(intl, group.payments)} />
          <PassportNote>
            {formatMessage({ id: "public.passport.money.members.amountsHeld" })}
          </PassportNote>
        </>
      )}
      <PassportNote>
        {formatMessage(
          { id: "public.passport.money.members.plans" },
          { plans: group.plans, finalized: group.plansFinalized, revised: group.plansRevised }
        )}
      </PassportNote>
      {waitingForPlan}
      <PassportSource>
        <p>{formatMessage({ id: "public.passport.money.members.source" })}</p>
      </PassportSource>
    </>
  );
}

/** `§ 03`: how to read the record, said once so no line has to repeat it. */
export function PassportReadingSection() {
  const { formatMessage } = useIntl();
  const notes = [
    formatMessage({ id: "public.passport.reading.window" }),
    formatMessage({ id: "public.passport.reading.privacy" }),
    formatMessage({ id: "public.passport.reading.rehearsals" }),
    formatMessage({ id: "public.passport.reading.consent" }),
    formatMessage({ id: "public.passport.reading.sources" }),
  ];
  return (
    <Section
      id="public-passport-reading"
      kicker={formatMessage({
        id: "public.passport.reading.kicker",
        defaultMessage: "§ 03: Reading this record",
      })}
      heading={formatMessage({
        id: "public.passport.reading.heading",
        defaultMessage: "What these figures mean",
      })}
    >
      <ul className="mt-8 flex max-w-3xl flex-col gap-4 text-base leading-relaxed text-text-sub-600">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </Section>
  );
}
