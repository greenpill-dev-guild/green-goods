import type {
  PassportMoneyLine,
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
 * `§ 02 G$ payments` on the passport: what was declared beside what was sent, confirmed, failed or
 * canceled. A declared amount is intent. Only a confirmed arrival is money received, and the two
 * are never shown as one figure. Amounts stay in G$ and are not converted.
 */

/** One token's payments by outcome, each as its own row. */
function outcomeRows(
  intl: IntlShape,
  line: PassportMoneyLine,
  declared?: bigint
): { unitLabel: string; value: string }[] {
  const token = passportMoneyToken(line.token);
  if (!token) return [];
  const { formatMessage } = intl;
  const amount = (value: bigint) =>
    `${passportAmount(intl, value, token.decimals)} ${token.symbol}`;
  const rows = [
    {
      unitLabel: formatMessage({
        id: "public.passport.money.confirmed",
        defaultMessage: "Confirmed as arrived",
      }),
      value: amount(line.confirmed),
    },
    {
      unitLabel: formatMessage({
        id: "public.passport.money.awaiting",
        defaultMessage: "Sent, not yet confirmed",
      }),
      value: amount(line.awaiting),
    },
    {
      unitLabel: formatMessage({
        id: "public.passport.money.failed",
        defaultMessage: "Sent and did not arrive",
      }),
      value: amount(line.failed),
    },
    {
      unitLabel: formatMessage({
        id: "public.passport.money.cancelled",
        defaultMessage: "Canceled before sending",
      }),
      value: amount(line.cancelled),
    },
  ];
  return declared === undefined
    ? rows
    : [
        {
          unitLabel: formatMessage({
            id: "public.passport.money.declared",
            defaultMessage: "Declared, not yet paid",
          }),
          value: amount(declared > line.confirmed ? declared - line.confirmed : 0n),
        },
        ...rows,
      ];
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
                  label={formatMessage({
                    id: "public.passport.money.byOutcome",
                    defaultMessage: "By outcome",
                  })}
                  rows={outcomeRows(intl, line)}
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
  if (group.plans === 0 && group.lines.length === 0) {
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
  const declaredByToken = new Map(group.declared.map((line) => [line.token, line.amount]));
  // A plan can declare an amount before any payment exists for its token.
  const lines: PassportMoneyLine[] = [
    ...group.lines,
    ...group.declared
      .filter((line) => !group.lines.some((paid) => paid.token === line.token))
      .map((line) => ({
        token: line.token,
        confirmed: 0n,
        awaiting: 0n,
        failed: 0n,
        cancelled: 0n,
      })),
  ];
  return (
    <>
      <PassportFigure>
        {formatMessage(
          { id: "public.passport.money.members.figure" },
          { count: group.payments.confirmed }
        )}
      </PassportFigure>
      {lines.map((line) => (
        <PassportUnitRows
          key={line.token}
          label={formatMessage({
            id: "public.passport.money.byOutcome",
            defaultMessage: "By outcome",
          })}
          rows={outcomeRows(intl, line, declaredByToken.get(line.token) ?? 0n)}
        />
      ))}
      <PassportNote>
        {formatMessage(
          { id: "public.passport.money.members.plans" },
          { plans: group.plans, finalized: group.plansFinalized, revised: group.plansRevised }
        )}
      </PassportNote>
      {group.payments.failed > 0 ? (
        <PassportNote>
          {formatMessage(
            { id: "public.passport.money.members.failed" },
            { count: group.payments.failed }
          )}
        </PassportNote>
      ) : null}
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
