import {
  type ServiceAccessAction,
  type ServiceAccessActionResult,
  type ServiceAccessSnapshot,
  type ServiceVoucherSetup,
  selectServiceAccessAction,
} from "@green-goods/shared/commitment-pooling";
import { Button } from "@green-goods/shared/components/Button";
import { useRef, useState } from "react";
import { useIntl } from "react-intl";
import { type VoucherReviewKind, voucherReviewAction } from "./serviceVoucherReview";
import { VoucherDeliverySheet } from "./VoucherDeliverySheet";
import { VoucherSetupFacts } from "./VoucherSetupFacts";
import { VoucherSetupProgress } from "./VoucherSetupProgress";
import { VoucherSetupSheet } from "./VoucherSetupSheet";

interface VoucherSetupCardProps {
  snapshot: ServiceAccessSnapshot;
  setup: ServiceVoucherSetup;
  onAction: (action: ServiceAccessAction) => Promise<ServiceAccessActionResult>;
}

/** Each setup and fixed leg owns its pending UI; one leg never locks another leg. */
export function VoucherSetupCard({ snapshot, setup, onAction }: VoucherSetupCardProps) {
  const { formatMessage } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.serviceAccess.${key}` });
  const [review, setReview] = useState<VoucherReviewKind | "final" | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const receiptScope =
    `${snapshot.key.buyer}:${setup.setupId}:${setup.authorizationHash}`.toLowerCase();
  const [observation, setObservation] = useState<{
    id: string;
    confirmed: boolean;
    scope: string;
  } | null>(null);
  const inFlight = useRef(new Set<string>());
  const kinds: (VoucherReviewKind | "final")[] = [];
  for (const action of setup.availableActions) {
    if (action === "dispatchVoucherSetupCommand") kinds.push("authorization", "decision");
    else if (action === "executeVoucherFinalLeg") kinds.push("release", "refund");
    else if (action === "finalizeVoucherAllocation") kinds.push("final");
    else if (action !== "prepareVoucherSetup") kinds.push(action);
  }
  const operation = (action: ServiceAccessAction) =>
    "leg" in action ? action.leg : "kind" in action ? action.kind : action.action;
  const run = async (action: ServiceAccessAction) => {
    const key = operation(action);
    if (inFlight.current.has(key) || !selectServiceAccessAction(snapshot, action).allowed) return;
    inFlight.current.add(key);
    setPending([...inFlight.current]);
    setFailed(false);
    if ("leg" in action) setReview(null);
    try {
      const result = await onAction(action);
      setObservation({
        id: result.observationId,
        confirmed: result.kind === "onchain",
        scope: receiptScope,
      });
      if (!("leg" in action)) setReview(null);
    } catch {
      setFailed(true);
    } finally {
      inFlight.current.delete(key);
      setPending([...inFlight.current]);
    }
  };
  const reviewPending =
    review === "final"
      ? pending.includes("finalizeVoucherAllocation")
      : review !== null && pending.includes(review);
  return (
    <article
      className="space-y-4 rounded-xl border border-stroke-soft-200 p-4"
      aria-label={text(setup.relationship === "prior" ? "priorSetup" : "currentSetup")}
    >
      <h3 className="text-sm font-semibold">
        {text(setup.relationship === "prior" ? "priorSetup" : "currentSetup")}
      </h3>
      <VoucherSetupProgress setup={setup} />
      <VoucherSetupFacts setup={setup} />
      {failed ? (
        <p role="alert" className="text-sm text-error-base">
          {text("actionError")}
        </p>
      ) : null}
      {observation?.scope === receiptScope ? (
        <p role="status" className="break-all text-xs">
          {formatMessage(
            {
              id: observation.confirmed
                ? "app.serviceAccess.transactionReceipt"
                : "app.serviceAccess.observation",
            },
            { id: observation.id }
          )}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {kinds.map((kind) => {
          const action = kind === "final" ? null : voucherReviewAction(setup, kind);
          if (kind !== "final" && action && !selectServiceAccessAction(snapshot, action).allowed)
            return null;
          return (
            <Button
              key={kind}
              type="button"
              emphasis="secondary"
              disabled={
                pending.includes(kind === "final" ? "finalizeVoucherAllocation" : kind) ||
                (kind !== "final" && !action)
              }
              onClick={() => setReview(kind)}
            >
              {text(kind === "final" ? "actions.finalizeVoucherAllocation" : `review.${kind}`)}
            </Button>
          );
        })}
      </div>
      <VoucherSetupSheet
        open={review !== null && review !== "final"}
        snapshot={snapshot}
        setup={setup}
        kind={review === "final" || review === null ? undefined : review}
        isPending={reviewPending}
        onOpenChange={(open) => !open && setReview(null)}
        onConfirm={(action) => void run(action)}
      />
      <VoucherDeliverySheet
        open={review === "final"}
        snapshot={snapshot}
        setup={setup}
        isPending={reviewPending}
        onOpenChange={(open) => !open && setReview(null)}
        onConfirm={(action) => void run(action)}
      />
    </article>
  );
}
