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
import { issuerAmount, issuerListing, issuerStage } from "./serviceIssuerPresentation";

interface Props {
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

interface SectionAct {
  id: string;
  label: string;
  run: () => void;
}

/**
 * Command Surface: balances are observations; signing always follows a separate exact review.
 * The issuer's acts are named (approve a booking, propose a return, issue more, approve for
 * rewards, pause and resume); each still prepares one exact review that expires in five
 * minutes, and only one transaction is ever pending at a time.
 */
export function ServiceIssuerPanel({
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
  const { formatMessage, locale } = useIntl();
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
    asset.kind === "individual" &&
    snapshot.actor.address.toLowerCase() === asset.ownerReserve.toLowerCase() &&
    snapshot.actor.address.toLowerCase() === asset.sourceAuthority.toLowerCase();
  const pendingReview =
    snapshot.pending?.review ?? (outcome?.status === "pending" ? outcome.pending.review : null);
  const pending = Boolean(snapshot.pending || outcome?.status === "pending" || uncertain);
  const checkStatus = () =>
    void run(async () => {
      if (pendingReview) setSentAction(pendingReview.action);
      const result = await onReconcile();
      setOutcome(result);
      setUncertain(false);
      setReviewed(null);
    });
  const amount = (value: bigint | null) =>
    value === null ? text("unknown") : issuerAmount(value, asset, locale);
  const deliveredAsset =
    sentAction?.kind === "exchange"
      ? assets.find((a) => a.id === sentAction.outputAssetId)
      : undefined;
  const allowance = snapshot.reserveAllowance ?? 0n;
  const stage = issuerStage(snapshot, pending).stage;
  const listing = issuerListing(snapshot);
  const issue: SectionAct = {
    id: "issue",
    label: ms("a.issue"),
    run: () => setEntry({ kind: "issue" }),
  };
  const forRewards: SectionAct = {
    id: "allow",
    label: ms("a.allow"),
    run: () => setEntry({ kind: "allowance" }),
  };
  const pause: SectionAct = {
    id: "pause",
    label: ms("a.pause"),
    run: () => prepare({ kind: "configureReserve", enabled: false }, "pause"),
  };
  const enable = (intent: IssuerIntent): SectionAct => ({
    id: intent,
    label: ms(intent === "resume" ? "a.resume" : "a.enable"),
    run: () => prepare({ kind: "configureReserve", enabled: true }, intent),
  });
  // The section's own acts; a booking's acts sit in its row.
  const acts: SectionAct[] = !ownsReserve
    ? []
    : pending
      ? [{ id: "check", label: ms("a.check"), run: checkStatus }]
      : stage === "setup"
        ? allowance === 0n && asset.adapterAllowance !== null
          ? [
              {
                id: "allow",
                label: ms("a.allowN", { count: amount(asset.adapterAllowance) }),
                run: () =>
                  prepare(
                    { kind: "approveReserve", amount: asset.adapterAllowance! },
                    "approveReserve"
                  ),
              },
            ]
          : [enable("enable")]
        : stage === "paused"
          ? [allowance === 0n ? forRewards : enable("resume")]
          : stage === "short"
            ? [forRewards, pause]
            : stage === "ok"
              ? [issue, pause]
              : [];
  const status =
    outcome?.status === "confirmed" ? (
      <p role="status" className="text-sm">
        {outcome.currentStateMatchesReceipt === false ? (
          <span className="block">{text("stateChangedAfterReceipt")}</span>
        ) : null}
        {outcome.deliveredOutput !== undefined ? (
          <span className="block">
            {text("actualOutput")}:{" "}
            {deliveredAsset
              ? issuerAmount(outcome.deliveredOutput, deliveredAsset, locale)
              : `${outcome.deliveredOutput} ${text("baseUnits")}`}
          </span>
        ) : null}
        <a
          className="underline underline-offset-4"
          href={`https://gnosisscan.io/tx/${outcome.transactionHash}`}
          target="_blank"
          rel="noreferrer"
        >
          {text("confirmed")}
        </a>
      </p>
    ) : outcome?.status === "reverted" ? (
      <p role="status" className="text-sm">
        {text("reverted")}
      </p>
    ) : null;
  return (
    <div className="space-y-4" data-component="ServiceIssuerPanel" data-listing={listing}>
      <h3 className="text-sm font-semibold leading-5 text-text-strong-950">{asset.name}</h3>
      {ownsReserve ? (
        <ServiceIssuerOverview snapshot={snapshot} pending={pending} />
      ) : (
        <>
          <FactList frame="inset">
            <FactRow label={text("held")} value={amount(snapshot.holdingBalance)} />
            <FactRow label={text("exchangeAllowance")} value={amount(snapshot.poolAllowance)} />
          </FactList>
          <div className="space-y-1 text-xs text-text-sub-600">
            <p>{text("owedUnknown")}</p>
            <p>{text("returnedCapacity")}</p>
          </div>
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
              key={`${snapshot.actor.address}:${asset.id}`}
              asset={asset}
              assets={assets}
              disabled={busy}
              onQuote={onQuote}
              onReview={(action) => prepare(action)}
            />
          )}
        </>
      )}
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
      {acts.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {acts.map((act, index) => (
            <Button
              key={act.id}
              data-act={act.id}
              type="button"
              emphasis={index === 0 ? "primary" : "secondary"}
              loading={busy && index === 0}
              disabled={busy}
              onClick={act.run}
            >
              {act.label}
            </Button>
          ))}
        </div>
      ) : null}
      {status}
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
