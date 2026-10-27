import {
  type ServiceIssuerDraft,
  type ServiceIssuerDraftRecord,
  serviceIssuerApprovalProvenance,
  serviceIssuerDraftApproval,
} from "@green-goods/shared/commitment-pooling";
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { RiCheckboxCircleLine, RiSettings3Line, RiUserLine, RiWallet3Line } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { ServiceIssuerApproveSheet } from "./ServiceIssuerApproveSheet";
import { issuerCount } from "./serviceIssuerPresentation";
import { draftFacts, factValue } from "./serviceIssuerDraftFacts";
import { type IssuerBand, ServiceIssuerBand, ServiceIssuerSteps } from "./ServiceIssuerStatus";

type DraftState = "review" | "approved" | "changed" | "declined";

interface Props {
  record: ServiceIssuerDraftRecord;
  /** Whether this account can sign on the voucher network; the draft waits until it can. */
  canSign: boolean;
  approving: boolean;
  onApprove: (draft: ServiceIssuerDraft) => Promise<unknown>;
  onAskForChanges?: (draft: ServiceIssuerDraft) => void;
  onDecline?: (draft: ServiceIssuerDraft) => void;
}

/**
 * A member's draft service in their Service Assets: what they would promise, what stays theirs,
 * and the approval only they can give, signed from their own account. A steward's help is named
 * as help; nothing a steward does reads as approval.
 */
export function ServiceIssuerOnboarding({
  record,
  canSign,
  approving,
  onApprove,
  onAskForChanges,
  onDecline,
}: Props) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: `app.voucher.ob.${id}` }, values);
  const [sheet, setSheet] = useState(false);
  const { draft, approval } = record;
  const coverage = serviceIssuerDraftApproval(draft, approval);
  const state: DraftState = record.declinedAt
    ? "declined"
    : coverage === "current"
      ? "approved"
      : coverage === "outdated"
        ? "changed"
        : "review";
  const facts = draftFacts(draft, intl);
  const date = (seconds: bigint) =>
    intl.formatDate(Number(seconds) * 1000, { month: "short", day: "numeric", year: "numeric" });
  const changedSettings = intl.formatList(
    (draft.changed.length ? draft.changed : ["terms"]).map((setting) => t(`set.${setting}`))
  );
  const band: IssuerBand = {
    review: {
      tone: "attention",
      pill: { label: t("st.draft"), variant: "warning" },
      needsYou: true,
      title: t("n.draft.t"),
      body: t("n.draft.b"),
    },
    approved: {
      tone: "waiting",
      pill: { label: t("st.setup"), variant: "info" },
      title: t("n.approved.t"),
      body: t("n.approved.b"),
    },
    changed: {
      tone: "attention",
      pill: { label: t("st.changed"), variant: "warning" },
      needsYou: true,
      title: t("n.changed.t"),
      body: t("n.changed.b", { name: draft.preparedBy, settings: changedSettings }),
    },
    declined: {
      tone: "neutral",
      pill: { label: t("st.declined"), variant: "neutral" },
      title: t("n.declined.t"),
      body: t("n.declined.b", { name: draft.preparedBy }),
    },
  }[state] as IssuerBand;
  band.from = t("kind", { name: draft.preparedBy, garden: draft.garden });
  const reviewable = state === "review" || state === "changed";
  const secondary = state === "changed" ? onDecline : onAskForChanges;
  const allowance = issuerCount(
    draft.terms.rewardAllowance,
    draft.terms.token.decimals,
    intl.locale
  );
  const placed = issuerCount(draft.terms.issue.pool, draft.terms.token.decimals, intl.locale);
  return (
    <div className="space-y-4" data-component="ServiceIssuerOnboarding" data-state={state}>
      <ServiceIssuerBand band={band} />
      {state === "approved" && approval ? (
        <ServiceIssuerSteps
          title={t("steps")}
          phases={[
            {
              id: "approved",
              title: t("p.approved"),
              who: t("who.you"),
              steps: [
                {
                  id: "approved",
                  text: t("sub.approved", { date: date(approval.signedAt) }),
                  state: "done",
                },
              ],
            },
            {
              id: "setup",
              title: t("p.setup"),
              who: t("who.team"),
              steps: [{ id: "token", text: t("sub.token"), state: "now" }],
            },
            {
              id: "registered",
              title: t("p.register"),
              who: t("who.safe"),
              steps: [{ id: "registered", text: t("sub.registered"), state: "todo" }],
            },
            {
              id: "admitted",
              title: t("p.admit"),
              who: t("who.pool"),
              steps: [{ id: "admitted", text: t("sub.admitted"), state: "todo" }],
            },
            {
              id: "yours",
              title: t("p.yours"),
              who: t("who.you"),
              steps: [
                { id: "allow", text: t("sub.allow", { count: allowance }), state: "todo" },
                { id: "enable", text: t("sub.enable"), state: "todo" },
                { id: "place", text: t("sub.place", { count: placed }), state: "todo" },
              ],
            },
          ]}
        />
      ) : null}
      <div>
        <h3 className="text-sm font-semibold leading-5 text-text-strong-950">{t("promise.t")}</h3>
        <FactList frame="inset" className="mt-1">
          {facts.map((fact) => (
            <FactRow
              key={fact.id}
              label={fact.label}
              value={
                <>
                  {factValue(fact)}
                  {fact.changed && state === "changed" ? (
                    <span className="mt-1 inline-block text-xs font-medium text-warning-dark">
                      {intl.formatMessage({ id: "app.voucher.ob.changed" })}
                    </span>
                  ) : null}
                </>
              }
            />
          ))}
          <FactRow
            label={intl.formatMessage({ id: "app.voucher.c.terms" })}
            value={intl.formatMessage(
              { id: "app.voucher.pp.version" },
              { v: draft.terms.revision }
            )}
            action={
              <a
                className="text-sm font-medium text-primary-on-surface underline underline-offset-4"
                href={draft.terms.document.reference}
                target="_blank"
                rel="noreferrer"
              >
                {intl.formatMessage({ id: "app.voucher.c.readTerms" })}
              </a>
            }
          />
        </FactList>
      </div>
      <div>
        <h3 className="text-sm font-semibold leading-5 text-text-strong-950">{t("yours.t")}</h3>
        <FactList frame="inset" className="mt-1">
          <FactRow icon={<RiUserLine />} label={t("y.token")} value={t("y.you")} />
          <FactRow icon={<RiWallet3Line />} label={t("y.reserve")} value={t("y.reserveV")} />
          <FactRow icon={<RiCheckboxCircleLine />} label={t("y.bookings")} value={t("y.you")} />
          <FactRow
            icon={<RiSettings3Line />}
            label={t("y.upgrade")}
            value={factValue({ value: t("y.upgradeV"), detail: t("y.upgradeS") })}
          />
        </FactList>
        <p className="mt-2 text-xs text-text-sub-600">{t("y.steward")}</p>
      </div>
      {reviewable ? (
        <div className="space-y-3">
          {!canSign ? (
            <Alert variant="warning" title={t("n.unavail.t")}>
              {t("n.unavail.b")}
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              data-act="review"
              disabled={!canSign}
              onClick={() => setSheet(true)}
            >
              {t("a.review")}
            </Button>
            {secondary ? (
              <Button type="button" emphasis="secondary" onClick={() => secondary(draft)}>
                {t(state === "changed" ? "a.decline" : "a.changes")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <details className="text-xs text-text-sub-600" data-component="ServiceIssuerDraftDetails">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium">
          {intl.formatMessage({ id: "app.voucher.c.tech" })}
        </summary>
        <ul className="space-y-1.5 break-all pb-1">
          <li>{t("x.token")}</li>
          <li>{t("x.source")}</li>
          <li>{t("x.record", { id: draft.id, v: draft.terms.revision })}</li>
          {approval ? (
            <li>
              {t("x.approval", { reference: serviceIssuerApprovalProvenance(approval).reference })}
            </li>
          ) : null}
        </ul>
      </details>
      {sheet && reviewable && canSign ? (
        <ServiceIssuerApproveSheet
          draft={draft}
          facts={facts}
          approving={approving}
          onClose={() => setSheet(false)}
          onApprove={async () => {
            await onApprove(draft);
            setSheet(false);
          }}
        />
      ) : null}
    </div>
  );
}
