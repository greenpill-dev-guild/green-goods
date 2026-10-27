import {
  type ServiceAccessAction,
  type ServiceAccessSnapshot,
  selectServiceAccessAction,
} from "@green-goods/shared/commitment-pooling";
import { Button } from "@green-goods/shared/components/Button";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { formatServiceAccessAmount } from "./serviceAccessPresentation";

interface VoucherPilotJourneyProps {
  snapshot: ServiceAccessSnapshot;
  busy: boolean;
  onAction: (action: ServiceAccessAction) => Promise<void>;
}

// Command: rehearse an earned service voucher beside the existing promise and escrow controls.
export function VoucherPilotJourney({ snapshot: s, busy, onAction }: VoucherPilotJourneyProps) {
  const { formatMessage, locale } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.serviceAccess.pilot.${key}` });
  const [review, setReview] = useState<ServiceAccessAction | null>(null);
  const [agreed, setAgreed] = useState(false);
  const p = s.pilot;
  const fingerprint = JSON.stringify(
    [s.key, s.capabilities, p?.exchange.quote, p?.exchange.status],
    (_key, v: unknown) => (typeof v === "bigint" ? v.toString() : v)
  );
  useEffect(() => {
    setReview(null);
    setAgreed(false);
  }, [fingerprint]);
  if (!p) return null;
  const local = s.evidence === "local-rehearsal" && s.capabilities.mutation === "local-rehearsal";
  const allowed = (action: ServiceAccessAction) =>
    local && selectServiceAccessAction(s, action).allowed;
  const action = (a: ServiceAccessAction, label: string, needsReview = false) =>
    allowed(a) ? (
      <Button
        key={label}
        type="button"
        emphasis="secondary"
        disabled={busy}
        onClick={() => (needsReview ? (setReview(a), setAgreed(false)) : void onAction(a))}
      >
        {text(label)}
      </Button>
    ) : null;
  const amount = (n: bigint, asset = p.assets.b) =>
    formatServiceAccessAmount(n, asset, locale, text("baseUnits"));
  const reward = p.reward;
  const exchange = p.exchange;
  const q = exchange.quote;
  return (
    <div className="space-y-4" data-component="VoucherPilotJourney">
      <p className="text-sm font-medium">{text("title")}</p>
      <p className="text-xs leading-relaxed text-text-sub-600">{text("fictional")}</p>
      {reward ? (
        <div className="space-y-2">
          <p className="text-sm">{text("work")}</p>
          <p className="text-xs text-text-sub-600">{text("evidence")}</p>
          <p role="status" className="text-sm">
            {text("voucherReward")}: {text(`state.${reward.voucher.state}`)} ·{" "}
            {amount(reward.voucher.amount, reward.voucher.asset)}
          </p>
          <p className="text-xs text-text-sub-600">
            {text("rewardAck")}: {text(`ack.${reward.voucher.acknowledgment}`)}
          </p>
          {reward.gd ? (
            <>
              <p role="status" className="text-sm">
                {text("monetaryReward")}: {text(`state.${reward.gd.state}`)} ·{" "}
                {amount(reward.gd.amount, reward.gd.asset)}
              </p>
              <p className="text-xs text-text-sub-600">
                {text("rewardAck")}: {text(`ack.${reward.gd.acknowledgment}`)}
              </p>
            </>
          ) : null}
          <p className="text-xs text-text-sub-600">{text("independent")}</p>
          <div className="flex flex-wrap gap-2">
            {action({ action: "deliverPilotReward", asset: "voucher" }, "deliverVoucher", true)}
            {action({ action: "acknowledgePilotReward", asset: "voucher" }, "ackVoucher")}
            {reward.gd
              ? action({ action: "deliverPilotReward", asset: "gd" }, "deliverGd", true)
              : null}
            {reward.gd ? action({ action: "acknowledgePilotReward", asset: "gd" }, "ackGd") : null}
          </div>
        </div>
      ) : null}
      <div className="space-y-2 text-sm">
        <p>{text("fullAccess")}</p>
        <p className="text-xs text-text-sub-600">{text("booking")}</p>
        <p className="text-xs text-text-sub-600">{text("remedy")}</p>
        <p>
          {text("holdings")}: {amount(p.holdings.a, p.assets.a)} · {amount(p.holdings.b)}
        </p>
        {p.holdings.b >= p.service.voucherUnits ? <p role="status">{text("direct")}</p> : null}
        {s.key.commitmentId !== p.serviceCommitmentId ? (
          <Link
            className="inline-flex min-h-11 items-center text-sm font-medium underline"
            to={`../${p.serviceCommitmentId}`}
            relative="path"
          >
            {text("openService")}
          </Link>
        ) : null}
      </div>
      {(p.holdings.a > 0n || exchange.status !== "none") && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">{text("exchange")}</h3>
          <p className="text-xs text-text-sub-600">{text("exchangeHelp")}</p>
          {q ? (
            <dl className="space-y-1 text-sm">
              <Fact label={text("input")}>{amount(q.input, p.assets.a)}</Fact>
              <Fact label={text("output")}>{amount(q.netOutput)}</Fact>
              <Fact label={text("fees")}>
                {amount(q.poolFee)} + {amount(q.protocolFee)}
              </Fact>
              <Fact label={text("minimum")}>{amount(q.minimumOutput)}</Fact>
              <Fact label={text("deadline")}>{q.deadline.toString()}</Fact>
            </dl>
          ) : null}
          {exchange.status === "unknown" ? (
            <p role="status" className="text-sm">
              {text("unknownSwap")}
            </p>
          ) : null}
          {exchange.status === "confirmed" ? (
            <p role="status" className="text-sm">
              {text("confirmedSwap")}
            </p>
          ) : null}
          {exchange.failure ? (
            <p role="alert" className="text-sm text-error-base">
              {text(`exchangeFailure.${exchange.failure}`)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {action({ action: "quotePilotExchange" }, "quote")}
            {q
              ? action(
                  { action: "approvePilotExchange", expectedQuoteId: q.id },
                  "approveExchange",
                  true
                )
              : null}
            {q
              ? action({ action: "executePilotExchange", quote: q }, "executeExchange", true)
              : null}
            {action({ action: "resolvePilotExchange" }, "resolveExchange")}
          </div>
        </div>
      )}
      <details className="space-y-2 text-xs text-text-sub-600">
        <summary>{text("budget")}</summary>
        <p>{text("noReservation")}</p>
        <dl className="space-y-1">
          <Fact label={text("reserve")}>{amount(p.inventory.reserve, p.inventory.asset)}</Fact>
          <Fact label={text("allowance")}>{amount(p.inventory.allowance, p.inventory.asset)}</Fact>
          <Fact label={text("undelivered")}>
            {amount(p.inventory.acceptedUndelivered, p.inventory.asset)}
          </Fact>
          <Fact label={text("poolInventory")}>{amount(exchange.inventory)}</Fact>
          <Fact label={text("poolLimit")}>
            {amount(exchange.inputHolding, p.assets.a)} / {amount(exchange.inputLimit, p.assets.a)}
          </Fact>
          <Fact label={text("listed")}>{text(exchange.listed ? "yes" : "no")}</Fact>
          <Fact label={text("pool")}>{exchange.pool}</Fact>
          <Fact label={text("recipient")}>{s.key.buyer}</Fact>
          {q ? (
            <>
              <Fact label={text("inputToken")}>{q.inputToken}</Fact>
              <Fact label={text("outputToken")}>{q.outputToken}</Fact>
              <Fact label={text("quoteId")}>{q.id}</Fact>
            </>
          ) : null}
          {reward ? (
            <>
              <Fact label={text("funder")}>{reward.voucher.funder}</Fact>
              <Fact label={text("receipt")}>{reward.voucher.receipt ?? text("none")}</Fact>
              {reward.gd ? (
                <Fact label={text("monetaryReceipt")}>{reward.gd.receipt ?? text("none")}</Fact>
              ) : null}
            </>
          ) : null}
          {exchange.receipt ? (
            <Fact label={text("receipt")}>{exchange.receipt.observationId}</Fact>
          ) : null}
        </dl>
      </details>
      {local ? (
        <details className="space-y-2">
          <summary className="text-xs text-text-sub-600">{text("roles")}</summary>
          <p className="text-xs text-text-sub-600">{text("roleHelp")}</p>
          <div className="flex flex-wrap gap-2">
            {action({ action: "observePilotRole", observation: "work-fulfilled" }, "fulfill")}
            {action(
              { action: "observePilotRole", observation: "voucher-budget-repaired" },
              "repair"
            )}
            {action({ action: "observePilotRole", observation: "issuer-approved" }, "issuer")}
            {action(
              { action: "observePilotRole", observation: "deposit-acknowledged" },
              "depositAck"
            )}
            {action({ action: "observePilotRole", observation: "provider-accepted" }, "provider")}
          </div>
        </details>
      ) : null}
      <DialogShell
        open={review !== null}
        onOpenChange={(open) => !open && setReview(null)}
        title={text("review")}
        description={text("fictional")}
        actions={{
          primary: {
            label: text("confirm"),
            disabled: busy || !agreed || !review || !allowed(review),
            onClick: () => {
              if (review && agreed && allowed(review)) {
                void onAction(review);
                setReview(null);
              }
            },
          },
        }}
      >
        <div className="space-y-3 text-sm">
          {review?.action === "deliverPilotReward" && reward ? (
            <p>
              {amount(reward[review.asset]!.amount, reward[review.asset]!.asset)} →{" "}
              <span className="break-all">{s.key.buyer}</span>
            </p>
          ) : null}
          {review?.action === "approvePilotExchange" ||
          review?.action === "executePilotExchange" ? (
            <>
              <p>{q ? `${amount(q.input, p.assets.a)} → ${amount(q.netOutput)}` : ""}</p>
              <p>
                {text("minimum")}: {q ? amount(q.minimumOutput) : ""} · {text("deadline")}:{" "}
                {q?.deadline.toString()}
              </p>
              <p className="break-all">
                {exchange.pool} · {s.key.buyer}
              </p>
              <p>
                {text("fees")}: {q ? `${amount(q.poolFee)} + ${amount(q.protocolFee)}` : ""}
              </p>
            </>
          ) : null}
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
            />
            {text("agree")}
          </label>
        </div>
      </DialogShell>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 break-all">
      <dt>{label}</dt>
      <dd className="text-text-strong-950">{children}</dd>
    </div>
  );
}
