import { ServiceIssuerReceipt } from "./ServiceIssuerReceipt";
import type {
  ServiceIssuerAction,
  ServiceIssuerAsset,
  ServiceIssuerExchangeQuote,
  ServiceIssuerOutcome,
  ServiceIssuerReview as Review,
  ServiceIssuerSnapshot,
} from "@green-goods/shared/commitment-pooling";
import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { type IssuerEntry, ServiceIssuerActSheet } from "./ServiceIssuerActSheet";
import { ServiceIssuerBookings } from "./ServiceIssuerBookings";
import { ServiceIssuerForm } from "./ServiceIssuerForm";
import { ServiceIssuerOverview } from "./ServiceIssuerOverview";
import { type IssuerIntent, ServiceIssuerReview } from "./ServiceIssuerReview";
import { ServiceIssuerActions } from "./ServiceIssuerActions";
import { issuerAmount, issuerListing } from "./serviceIssuerPresentation";

interface Props {
  /** Checkout spends held vouchers without displaying issuer administration. */
  holderOnly?: boolean;
  poolName?: string;
  snapshot?: ServiceIssuerSnapshot;
  assets: readonly ServiceIssuerAsset[];
  isLoading?: boolean;
  isError?: boolean;
  onRefresh: () => Promise<unknown>;
  onReview: (action: ServiceIssuerAction) => Promise<Review>;
  onExecute: (review: Review) => Promise<ServiceIssuerOutcome>;
  onReconcile: () => Promise<ServiceIssuerOutcome | null>;
  onQuote: (input: {
    outputAssetId: string;
    amount: bigint;
  }) => Promise<ServiceIssuerExchangeQuote>;
}

/**
 * Command Surface: balances are observations; signing always follows a separate exact review.
 * The issuer's acts are named (approve a booking, propose a return, issue more, approve for
 * rewards, pause and resume); each still prepares one exact review that expires in five
 * minutes, and only one transaction is ever pending at a time.
 */
export function ServiceIssuerPanel({
  holderOnly = false,
  poolName,
  snapshot,
  assets,
  isLoading,
  isError,
  onRefresh,
  onReview,
  onExecute,
  onReconcile,
  onQuote,
}: Props) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const text = (key: string) => formatMessage({ id: `app.profile.issuer.${key}` });
  const ms = (key: string, values?: Record<string, string>) =>
    formatMessage({ id: `app.voucher.ms.${key}` }, values);
  const [reviewed, setReviewed] = useState<{
    generation: number;
    review: Review;
    intent?: IssuerIntent;
  } | null>(null);
  const [entry, setEntry] = useState<IssuerEntry | null>(null);
  const [entryFailed, setEntryFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [outcome, setOutcome] = useState<ServiceIssuerOutcome | null>(null);
  const [sentAction, setSentAction] = useState<ServiceIssuerAction | null>(null);
  const [sentPool, setSentPool] = useState<{ name: string; address: string } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState(false);
  const scope =
    JSON.stringify(snapshot, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    ) ?? "";
  const current = useRef({ scope, generation: 0 });
  if (current.current.scope !== scope) {
    current.current = { scope, generation: current.current.generation + 1 };
  }
  const generation = current.current.generation;
  useEffect(() => {
    setReviewed(null);
  }, [generation]);
  const review = reviewed?.generation === generation ? reviewed.review : null;
  const run = async (operation: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(false);
    try {
      await operation();
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  /** One exact review per act; a review that lands after the snapshot changed is dropped. */
  const prepare = (action: ServiceIssuerAction, intent?: IssuerIntent) =>
    void run(async () => {
      const expected = generation;
      setEntryFailed(false);
      try {
        const value = await onReview(action);
        if (current.current.generation === expected) {
          setReviewed({ generation: expected, review: value, intent });
          setEntry(null);
        }
      } catch (failure) {
        setEntryFailed(true);
        throw failure;
      }
    });
  const refresh = () =>
    void run(async () => {
      await onRefresh();
    });
  if (isLoading) return <p className="text-sm text-text-sub-600">{text("loading")}</p>;
  if (isError || !snapshot || snapshot.evidence === "unavailable")
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-sub-600">{text(isError ? "readFailed" : "unconfigured")}</p>
        {isError ? (
          <Button type="button" emphasis="secondary" loading={busy} onClick={refresh}>
            {text("refresh")}
          </Button>
        ) : null}
      </div>
    );
  const asset = snapshot.asset;
  const ownsReserve =
    !holderOnly &&
    asset.kind === "individual" &&
    snapshot.actor.address.toLowerCase() === asset.ownerReserve.toLowerCase();
  const pendingReview =
    snapshot.pending?.review ?? (outcome?.status === "pending" ? outcome.pending.review : null);
  const pending = Boolean(snapshot.pending || outcome?.status === "pending" || uncertain);
  const poolContext = (value: Review) => {
    if (!["exchange", "approveExchange", "revokeExchange"].includes(value.action.kind)) return null;
    const address = value.action.kind === "exchange" ? value.call.address : value.call.args[0];
    return {
      name:
        value.actor.poolId === snapshot.actor.poolId
          ? (poolName ?? value.actor.poolId ?? text("unknown"))
          : (value.actor.poolId ?? text("unknown")),
      address: typeof address === "string" ? address : text("unknown"),
    };
  };
  const checkStatus = () =>
    void run(async () => {
      if (pendingReview) {
        setSentAction(pendingReview.action);
        setSentPool(poolContext(pendingReview));
      }
      const result = await onReconcile();
      setOutcome(result);
      setUncertain(false);
      setReviewed(null);
    });
  const amount = (value: bigint | null) =>
    value === null ? text("unknown") : issuerAmount(value, asset, intl);
  const deliveredAsset =
    sentAction?.kind === "exchange"
      ? assets.find((a) => a.id === sentAction.outputAssetId)
      : undefined;
  const listing = issuerListing(snapshot);
  return (
    <div className="space-y-4" data-component="ServiceIssuerPanel" data-listing={listing}>
      <h3 className="text-sm font-semibold leading-5 text-text-strong-950">{asset.name}</h3>
      {ownsReserve ? (
        <section className="space-y-3">
          <h4 className="text-sm font-semibold">
            {formatMessage({ id: "app.voucher.exchange.servicesOffered" })}
          </h4>
          <ServiceIssuerOverview snapshot={snapshot} pending={pending} />
        </section>
      ) : null}
      <details open={ownsReserve ? undefined : true} className="space-y-3">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
          {formatMessage({ id: "app.voucher.exchange.heldVouchers" })}
        </summary>
        <FactList frame="inset">
          <FactRow label={text("held")} value={amount(snapshot.holdingBalance)} />
          <FactRow label={text("exchangeAllowance")} value={amount(snapshot.poolAllowance)} />
        </FactList>
        {snapshot.poolStatus === "unavailable" ? (
          <p role="status" className="text-sm text-text-sub-600">
            {formatMessage({ id: "app.voucher.exchange.unavailable" })}
          </p>
        ) : null}
        {pending ? (
          <div className="space-y-3">
            <p role="status" className="text-sm">
              {text("pending")}
            </p>
            <Button type="button" emphasis="secondary" loading={busy} onClick={checkStatus}>
              {text("checkStatus")}
            </Button>
          </div>
        ) : (
          <ServiceIssuerForm
            key={`${snapshot.actor.address}:${asset.id}:${snapshot.actor.poolId}`}
            asset={asset}
            assets={assets}
            poolId={snapshot.actor.poolId}
            disabled={busy || !snapshot.actor.poolId}
            onQuote={onQuote}
            onReview={(action) => prepare(action)}
          />
        )}
      </details>
      {ownsReserve ? (
        <ServiceIssuerBookings
          bookings={snapshot.bookings}
          asset={asset}
          pending={pending ? (pendingReview?.action ?? null) : null}
          paused={!snapshot.reserveEnabled}
          disabled={busy || pending}
          onApprove={(booking) =>
            prepare(
              {
                kind: "approveBooking",
                setupId: booking.setupId,
                authorizationHash: booking.authorizationHash,
              },
              "approveBooking"
            )
          }
          onPropose={(booking) => setEntry({ kind: "return", booking })}
        />
      ) : null}
      {ownsReserve ? (
        <ServiceIssuerActions
          snapshot={snapshot}
          pending={pending}
          busy={busy}
          onCheck={checkStatus}
          onEntry={setEntry}
          onReview={prepare}
        />
      ) : null}
      <ServiceIssuerReceipt outcome={outcome} deliveredAsset={deliveredAsset} pool={sentPool} />
      {error ? (
        <p role="alert" className="text-sm text-error-base">
          {text(uncertain ? "unconfirmed" : "actionFailed")}
        </p>
      ) : null}
      {ownsReserve ? (
        <details className="text-xs text-text-sub-600" data-component="ServiceIssuerDetails">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">
            {formatMessage({ id: "app.voucher.c.tech" })}
          </summary>
          <ul className="space-y-1.5 break-all pb-1">
            <li>{ms("x.token", { address: asset.token.address })}</li>
            <li>{ms("x.bookings")}</li>
            <li>
              {ms("x.record", {
                reference: asset.service.approval.reference ?? text("unknown"),
              })}
            </li>
          </ul>
        </details>
      ) : null}
      <Button type="button" emphasis="tertiary" disabled={busy} onClick={refresh}>
        {text("refresh")}
      </Button>
      {entry && !review && !pending ? (
        <ServiceIssuerActSheet
          key={entry.kind === "return" ? `return:${entry.booking.setupId}` : entry.kind}
          entry={entry}
          snapshot={snapshot}
          busy={busy}
          failed={entryFailed}
          onClose={() => {
            setEntry(null);
            setEntryFailed(false);
          }}
          onReview={(action) =>
            prepare(
              action,
              action.kind === "issue"
                ? "issue"
                : action.kind === "authorizeReturn"
                  ? "authorizeReturn"
                  : "approveReserve"
            )
          }
        />
      ) : null}
      {review && !pending ? (
        <ServiceIssuerReview
          key={review.fingerprint}
          review={review}
          poolName={poolName}
          asset={asset}
          assets={assets}
          busy={busy}
          intent={reviewed?.intent}
          booking={
            "setupId" in review.action
              ? snapshot.bookings.records.find(
                  (b) =>
                    "setupId" in review.action &&
                    b.setupId === review.action.setupId &&
                    b.authorizationHash === review.action.authorizationHash
                )
              : undefined
          }
          onClose={() => setReviewed(null)}
          onConfirm={(value) =>
            void run(async () => {
              if (current.current.generation !== reviewed?.generation) return;
              setSentAction(value.action);
              setSentPool(poolContext(value));
              try {
                setOutcome(await onExecute(value));
              } catch (failure) {
                setUncertain(true);
                throw failure;
              } finally {
                setReviewed(null);
              }
            })
          }
        />
      ) : null}
    </div>
  );
}
