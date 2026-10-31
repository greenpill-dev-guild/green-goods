import type {
  ServiceVoucherSetup,
  VoucherAcknowledgment,
} from "@green-goods/shared/commitment-pooling";
import { Alert } from "@green-goods/shared/components/Alert";
import { useIntl } from "react-intl";
import { formatServiceAccessAmount } from "./serviceAccessPresentation";

/** Durable destination results and source observations remain separate evidence. */
export function VoucherSetupProgress({ setup }: { setup: ServiceVoucherSetup }) {
  const { formatMessage, locale } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.serviceAccess.${key}` });
  const d = setup.destination;
  const final = d?.finalAllocation;
  const amount = (n: bigint) =>
    formatServiceAccessAmount(n, setup.asset, locale, text("baseUnits"));
  const ack = (value: VoucherAcknowledgment, lane: string) => (
    <div className="space-y-1 text-xs text-text-sub-600">
      <h4 className="text-xs font-medium">{text(lane)}</h4>
      <p>
        {text("destinationSequence")}: {value.destinationSequence?.toString() ?? text("unknown")}
      </p>
      <p>
        {text("ackSent")}:{" "}
        {value.sent
          ? text("yes")
          : value.pending !== null &&
              (d?.evidence === "local-rehearsal" || value.destinationSequence !== null)
            ? text("no")
            : text("unknown")}{" "}
        · {text("ackSentSequence")}: {value.sentSequence?.toString() ?? text("unknown")}
      </p>
      <p>
        {text("ackObserved")}: {value.sourceObservedSequence.toString()}
      </p>
      {value.pending ? <p role="status">{text("ackPending")}</p> : null}
    </div>
  );
  return (
    <div className="space-y-3">
      <p className="text-sm">
        {text("sourceAccepted")}: {text(setup.source.acceptedEver ? "yes" : "no")}
      </p>
      <p className="text-sm">
        {text("sourceDecision")}: {text(`decision.${setup.source.decision}`)}
      </p>
      <p className="text-sm" role="status">
        {text("destinationPhase")}: {d ? text(`phase.${d.result.phase}`) : text("unknown")}
      </p>
      <p className="text-xs text-text-sub-600">{text("setupLifecycleHelp")}</p>
      {d ? (
        <>
          <dl className="space-y-2 text-sm">
            <div>
              <dt>{text("presented")}</dt>
              <dd>{amount(d.result.depositedUnits)}</dd>
            </div>
            <div>
              <dt>{text("setupRefunded")}</dt>
              <dd>{amount(d.result.setupRefundedUnits)}</dd>
            </div>
            <div>
              <dt>{text("issuerApproval")}</dt>
              <dd>{text(d.result.issuerApproved ? "issuerApproved" : "issuerPending")}</dd>
            </div>
          </dl>
          {d.pendingAction ? (
            <p role="status" className="text-sm">
              {text(`pendingAction.${d.pendingAction}`)} ·{" "}
              {text(d.result.failureHash ? "failed" : "pending")}
            </p>
          ) : null}
          {d.holderAbortRequested ? (
            <p role="status" className="text-sm">
              {text("holderAbortRequested")}
            </p>
          ) : null}
        </>
      ) : null}
      {final ? (
        <>
          <h4 className="text-sm font-medium">{text("finalFrozen")}</h4>
          <dl className="space-y-2 text-sm">
            <div>
              <dt>{text("approvedService")}</dt>
              <dd>
                {final.allocation.approvedDeliveredServiceUnits.toString()} /{" "}
                {setup.authorization.serviceUnits.toString()} {text("serviceUnits")}
              </dd>
            </div>
            <div>
              <dt>{text("releaseFixed")}</dt>
              <dd>
                {amount(final.allocation.releaseVoucherUnits)} →{" "}
                <span className="break-all">{setup.authorization.issuer}</span>
              </dd>
            </div>
            <div>
              <dt>{text("refundFixed")}</dt>
              <dd>
                {amount(final.allocation.refundVoucherUnits)} →{" "}
                <span className="break-all">{setup.authorization.holder}</span>
              </dd>
            </div>
          </dl>
          {(["release", "refund"] as const).map((leg) => (
            <p key={leg} role="status" className="text-sm">
              {text(`leg.${leg}`)}: {text(`legState.${final[leg].state}`)} · {text("attempts")}:{" "}
              {final[leg].attempts.toString()}
            </p>
          ))}
          {final.financiallyClosed ? (
            <Alert variant="info" title={text("closed")}>
              {text("closedBody")}
            </Alert>
          ) : null}
        </>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {ack(setup.acknowledgments.setup, "setupAck")}
        {ack(setup.acknowledgments.final, "finalAck")}
      </div>
    </div>
  );
}
