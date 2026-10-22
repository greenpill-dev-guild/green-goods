import {
  type ServiceAccessAction,
  type ServiceAccessActionKind,
  type ServiceAccessActionResult,
  type ServiceAccessSnapshot,
  selectServiceAccessAction,
} from "@green-goods/shared/commitment-pooling";
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { useRef, useState } from "react";
import { useIntl } from "react-intl";
import { ServiceAccessStatus } from "./ServiceAccessStatus";
import { ServiceConsentSheet } from "./ServiceConsentSheet";
import { serviceAssetHasUnits } from "./serviceAccessPresentation";
import { VoucherSetupCard } from "./VoucherSetupCard";
import { VoucherSetupSheet } from "./VoucherSetupSheet";

interface ServiceAccessPanelProps {
  snapshot: ServiceAccessSnapshot;
  isPending: boolean;
  onAction: (action: ServiceAccessAction) => Promise<ServiceAccessActionResult>;
  onRefresh: () => void;
}

// Command: service access stays beside the existing promise lifecycle.
export function ServiceAccessPanel({
  snapshot,
  isPending,
  onAction,
  onRefresh,
}: ServiceAccessPanelProps) {
  const { formatMessage } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.serviceAccess.${key}` });
  const [sheet, setSheet] = useState<"request" | "funding" | "setup" | null>(null);
  const [failed, setFailed] = useState(false);
  const [observation, setObservation] = useState<string | null>(null);
  const [sending, setSending] = useState<ServiceAccessActionKind | null>(null);
  const inFlight = useRef(false);
  const busy = isPending || sending !== null;
  const purchase = snapshot.personalPurchase;
  const local = snapshot.evidence === "local-rehearsal";
  const unavailable = snapshot.capabilities.mutation === "unavailable";
  if (
    !snapshot.knownService &&
    !snapshot.acceptancePolicy.blockGenericMemberAcceptance &&
    snapshot.voucherSetups.length === 0
  )
    return null;

  const run = async (action: ServiceAccessAction) => {
    if (
      inFlight.current ||
      busy ||
      unavailable ||
      !selectServiceAccessAction(snapshot, action).allowed
    )
      return;
    inFlight.current = true;
    setSending(action.action);
    setFailed(false);
    try {
      const result = await onAction(action);
      setObservation(result.observationId);
      setSheet(null);
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setSending(null);
    }
  };
  const basicAction = (kind: ServiceAccessActionKind): ServiceAccessAction | null => {
    switch (kind) {
      case "withdrawClaim":
        return snapshot.consent
          ? { action: kind, expectedClaimHash: snapshot.consent.claimHash }
          : null;
      case "payPersonal":
        return purchase && snapshot.personalFeeQuote && serviceAssetHasUnits(purchase.asset)
          ? {
              action: kind,
              purchaseId: purchase.purchaseId,
              reviewedFee: snapshot.personalFeeQuote,
            }
          : null;
      default:
        return null;
    }
  };
  const choose = (kind: ServiceAccessActionKind) => {
    if (kind === "requestClaim") setSheet("request");
    else if (kind === "pledgePersonal") setSheet("funding");
    else if (kind === "prepareVoucherSetup") setSheet("setup");
    else {
      const action = basicAction(kind);
      if (action) void run(action);
    }
  };

  return (
    <section
      className="space-y-4 border-t border-stroke-soft-200 pt-4"
      aria-label={text("title")}
      data-component="ServiceAccessPanel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold leading-5 text-text-strong-950">{text("title")}</h2>
        {local ? (
          <StatusBadge size="sm" variant="warning">
            {text("rehearsal")}
          </StatusBadge>
        ) : null}
      </div>
      {local ? (
        <p className="text-xs leading-relaxed text-text-sub-600">{text("rehearsalBody")}</p>
      ) : null}
      {unavailable ? (
        <Alert variant="info" title={text("unavailable")}>
          {[...new Set(snapshot.capabilities.reasons)].map((reason) => (
            <p key={reason}>{text(`reason.${reason}`)}</p>
          ))}
        </Alert>
      ) : null}
      {!unavailable &&
        [...new Set(snapshot.capabilities.reasons)].map((reason) => (
          <p key={reason} role="status" className="text-sm text-text-sub-600">
            {text(`reason.${reason}`)}
          </p>
        ))}
      <ServiceAccessStatus snapshot={snapshot} />
      {failed ? (
        <p role="alert" className="text-sm text-error-base">
          {text("actionError")}
        </p>
      ) : null}
      {observation ? (
        <p role="status" className="break-all text-xs text-text-sub-600">
          {formatMessage({ id: "app.serviceAccess.observation" }, { id: observation })}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {!unavailable &&
          snapshot.availableActions
            .filter((kind) =>
              [
                "requestClaim",
                "withdrawClaim",
                "pledgePersonal",
                "payPersonal",
                "prepareVoucherSetup",
              ].includes(kind)
            )
            .map((kind) => (
              <Button
                key={kind}
                type="button"
                disabled={
                  busy || (kind === "payPersonal" && !serviceAssetHasUnits(purchase?.asset))
                }
                loading={sending === kind}
                emphasis={kind === "withdrawClaim" ? "secondary" : "primary"}
                onClick={() => choose(kind)}
              >
                {text(kind === "requestClaim" ? "request" : `actions.${kind}`)}
              </Button>
            ))}
        <Button type="button" emphasis="secondary" disabled={busy} onClick={onRefresh}>
          {text("refresh")}
        </Button>
      </div>
      <ServiceConsentSheet
        open={sheet === "request" || sheet === "funding"}
        mode={sheet === "funding" ? "funding" : "request"}
        snapshot={snapshot}
        isPending={busy}
        onOpenChange={(open) => !open && setSheet(null)}
        onConfirm={(action) => void run(action)}
      />
      <VoucherSetupSheet
        open={sheet === "setup"}
        snapshot={snapshot}
        isPending={busy}
        onOpenChange={(open) => !open && setSheet(null)}
        onConfirm={(action) => void run(action)}
      />
      {snapshot.voucherSetups.map((setup) => (
        <VoucherSetupCard
          key={`${setup.authorization.sourceChainId}:${setup.authorization.sourceModule}:${setup.setupId}`}
          snapshot={snapshot}
          setup={setup}
          onAction={onAction}
        />
      ))}
    </section>
  );
}
