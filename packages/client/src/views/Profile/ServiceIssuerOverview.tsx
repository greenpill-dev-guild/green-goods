import type { ServiceIssuerSnapshot } from "@green-goods/shared/commitment-pooling";
import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import {
  issuerCapacity,
  issuerCount,
  issuerEscrowed,
  issuerListing,
  issuerStage,
} from "./serviceIssuerPresentation";
import { type IssuerBand, ServiceIssuerBand, ServiceIssuerSteps } from "./ServiceIssuerStatus";

type Onchain = Extract<ServiceIssuerSnapshot, { evidence: "onchain" }>;

const PILL = {
  setup: { id: "ob.st.setup", variant: "info" },
  listed: { id: "ms.p.listed", variant: "success" },
  paused: { id: "ms.p.paused", variant: "warning" },
  delisted: { id: "ms.p.delisted", variant: "neutral" },
} as const;

/**
 * The member's own service: one status message, what they can still deliver and where their
 * vouchers are, each as facts. Capacity comes from the reviewed terms and verified bookings,
 * never from token balances, and an unread number stays unknown rather than zero.
 */
export function ServiceIssuerOverview({
  snapshot,
  pending,
}: {
  snapshot: Onchain;
  pending: boolean;
}) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: `app.voucher.${id}` }, values);
  const rich = (id: string, values?: Record<string, ReactNode>) =>
    intl.formatMessage({ id: `app.voucher.${id}` }, values);
  const { asset } = snapshot;
  const count = (value: bigint | null) =>
    value === null ? t("ms.unknown") : issuerCount(value, asset.decimals, intl.locale);
  const capacity = issuerCapacity(snapshot);
  const { stage, booking } = issuerStage(snapshot, pending);
  const listing = issuerListing(snapshot);
  const holder = booking ? (
    <AddressDisplay key="holder" address={booking.authorization.holder}>
      {(name) => name}
    </AddressDisplay>
  ) : null;
  const allowance = count(asset.adapterAllowance);
  const message: Record<typeof stage, [IssuerBand["tone"], string, Record<string, ReactNode>?]> = {
    pending: ["waiting", "ms.n.pending"],
    approve: ["attention", "ms.n.approve", { holder }],
    admitting: ["waiting", "ms.n.admitting"],
    setup: ["attention", "ms.n.setup", { count: allowance }],
    delisted: ["neutral", "ms.n.delisted"],
    paused: ["neutral", "ms.n.paused"],
    short: ["neutral", "ms.n.short"],
    ok: [
      "neutral",
      capacity.left === null ? "ms.n.okUnknown" : "ms.n.ok",
      { booked: count(capacity.booked), left: count(capacity.left) },
    ],
  };
  const [tone, key, values] = message[stage];
  const band: IssuerBand = {
    tone,
    pill: { label: t(PILL[listing].id), variant: PILL[listing].variant },
    needsYou: tone === "attention",
    title: rich(`${key}.t`, values),
    body: rich(`${key}.b`, values),
  };
  const delivered = capacity.delivered ?? 0n;
  const promised = capacity.promised ?? 0n;
  const reserveAllowance = snapshot.reserveAllowance ?? 0n;
  return (
    <div className="space-y-4" data-component="ServiceIssuerOverview" data-stage={stage}>
      <ServiceIssuerBand band={band} />
      {stage === "setup" || stage === "admitting" ? (
        <ServiceIssuerSteps
          title={t("ob.steps")}
          phases={[
            {
              id: "admitted",
              title: t("ob.p.admit"),
              who: t("ob.who.pool"),
              steps: [
                {
                  id: "registered",
                  text: t("ob.sub.registered"),
                  state: snapshot.pool.admitted ? "done" : "now",
                },
                {
                  id: "admitted",
                  text: t("ob.sub.admitted"),
                  state: snapshot.pool.admitted ? "done" : "todo",
                },
              ],
            },
            {
              id: "yours",
              title: t("ob.p.yours"),
              who: t("ob.who.you"),
              steps: [
                {
                  id: "allow",
                  text: t("ob.sub.allow", { count: allowance }),
                  state: reserveAllowance > 0n ? "done" : snapshot.pool.admitted ? "now" : "todo",
                },
                {
                  id: "enable",
                  text: t("ob.sub.enable"),
                  state: reserveAllowance > 0n ? "now" : "todo",
                },
                { id: "place", text: t("ms.sub.place"), state: "todo" },
              ],
            },
          ]}
        />
      ) : null}
      <div>
        <h3 className="text-sm font-semibold leading-5 text-text-strong-950">{t("ms.cap.t")}</h3>
        <FactList frame="inset" className="mt-1">
          <FactRow label={t("ms.cap.promised")} value={count(capacity.promised)} />
          <FactRow label={t("ms.cap.booked")} value={count(capacity.booked)} />
          <FactRow label={t("ms.cap.delivered")} value={count(capacity.delivered)} />
          <FactRow label={t("ms.cap.left")} value={count(capacity.left)} />
        </FactList>
        {capacity.promised !== null && capacity.delivered !== null ? (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-text-sub-600">
              <span>{t("ms.cap.delivered")}</span>
              <span className="font-semibold text-text-strong-950">
                {t("ms.cap.count", { done: count(delivered), of: count(promised) })}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={t("ms.cap.bar", {
                delivered: count(capacity.delivered),
                booked: count(capacity.booked),
                left: count(capacity.left),
                promised: count(capacity.promised),
              })}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={promised > 0n ? Number((delivered * 100n) / promised) : 0}
              className="h-1.5 overflow-hidden rounded-full bg-stroke-soft-200"
            >
              <span
                className="block h-full rounded-full bg-success-base"
                style={{ width: `${promised > 0n ? Number((delivered * 100n) / promised) : 0}%` }}
              />
            </div>
          </div>
        ) : null}
        <p className="mt-2 text-xs text-text-sub-600">{t("ms.cap.note")}</p>
      </div>
      <div>
        <h3 className="text-sm font-semibold leading-5 text-text-strong-950">{t("ms.vou.t")}</h3>
        <FactList frame="inset" className="mt-1">
          <FactRow label={t("ms.v.issued")} value={count(snapshot.totalMinted)} />
          <FactRow label={t("ms.v.pool")} value={count(snapshot.pool.holding)} />
          <FactRow label={t("ms.v.reserve")} value={count(snapshot.issuerReserveBalance)} />
          <FactRow label={t("ms.v.escrow")} value={count(issuerEscrowed(snapshot))} />
          <FactRow
            label={t("ms.v.allow")}
            value={t("ms.v.allowV", { left: count(snapshot.reserveAllowance), of: allowance })}
          />
        </FactList>
        <p className="mt-2 text-xs text-text-sub-600">{t("ms.v.note")}</p>
      </div>
    </div>
  );
}
