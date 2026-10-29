import {
  type CommitmentDerivedState,
  type RequestRewardDelivery,
  requestRewardDeliveries,
  type ServiceAccessSnapshot,
  type VoucherIssuer,
} from "@green-goods/shared/commitment-pooling";
import type { ItemRowTone } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import type { IntlShape } from "react-intl";
import { formatVoucherMessage } from "./serviceBooking";
import type { ServiceBandTone } from "./serviceBookingTypes";

export interface ServiceRewardRow {
  id: string;
  kind: RequestRewardDelivery["kind"];
  title: string;
  status: { label: string; tone: ItemRowTone };
  detail: string;
}

export interface ServiceRewardsView {
  rows: ServiceRewardRow[];
  /** How rewards arrive and whether anything is set aside, as fact rows. */
  facts: { id: "arrive" | "aside"; label: string; value: string; detail: string }[];
  /** Where each reward comes from and its receipt, only under Transaction details (D2). */
  details: string[];
  band: { tone: ServiceBandTone; sentence: string; needsYou: boolean };
  /**
   * Where the reader's own agreement can't be signed here (a garden's claim, or no signer), the
   * page says so with one door instead of an act that can't run.
   */
  agreementUnavailable: { title: string; body: string; label: string } | null;
  /**
   * The reader's own agreement to the reward, before they take it up: offered now, already
   * given, or neither.
   */
  agree: "offered" | "agreed" | null;
  /** Agree to the Rewards: the reward as agreed to, before the member takes the request up. */
  agreeSheet: null | {
    title: string;
    work: string;
    vouchers: string;
    value: string;
    detail: string;
    consent: string;
    cta: string;
  };
  /** The vouchers arrived, so the reader can go to them: See Your Vouchers. */
  vouchersReceived: boolean;
}

export interface ServiceRewardsInput {
  snapshot: ServiceAccessSnapshot;
  coreState: CommitmentDerivedState;
  /** The voucher reward's issuer, from the voucher wallet's directory: a garden or a member. */
  issuer: Pick<VoucherIssuer, "name" | "gender" | "kind"> | null;
  /** The request's garden, whose pool pays any G$. */
  garden: string;
  /**
   * How the reader could take the request up, so agreeing to its reward is theirs to do: at once
   * (an open request) or by asking its stewards; null when they can't.
   */
  takeUp: "open" | "reviewed" | "service" | null;
}

const STATUS: Record<RequestRewardDelivery["status"], { id: string; tone: ItemRowTone }> = {
  "after-work": { id: "rw.s.notYet", tone: "neutral" },
  "on-the-way": { id: "rw.s.pending", tone: "info" },
  waiting: { id: "rw.s.waiting", tone: "warning" },
  delayed: { id: "rw.s.delayed", tone: "warning" },
  received: { id: "rw.s.received", tone: "success" },
};
const OPEN: readonly CommitmentDerivedState[] = ["OFFERED", "REQUESTED"];

/** A request's rewards, one row each: vouchers and G$ never wait for each other. */
export function serviceRewardsView(
  input: ServiceRewardsInput,
  intl: Pick<IntlShape, "formatMessage" | "locale">
): ServiceRewardsView | null {
  const deliveries = requestRewardDeliveries(input.snapshot);
  if (!deliveries || deliveries.length === 0) return null;
  const issuer = input.issuer?.name ?? deliveries[0]!.asset.symbol ?? "";
  const t = (id: string, values: Record<string, string | number> = {}) =>
    formatVoucherMessage(intl, id, {
      issuer,
      gender: input.issuer?.gender ?? "other",
      garden: input.garden,
      ...values,
    });
  const amount = (d: RequestRewardDelivery) =>
    formatTokenAmount(d.amount, d.asset.decimals ?? 0, 2, intl.locale);
  const voucher = deliveries.find((d) => d.kind === "voucher") ?? null;
  const gd = deliveries.find((d) => d.kind === "gd") ?? null;
  const oneVoucher = voucher?.amount === 10n ** BigInt(voucher?.asset.decimals ?? 0);
  const vouchers = voucher
    ? t("rw.vou", {
        n: amount(voucher),
        unit: t("unit", {
          count: voucher.amount === 10n ** BigInt(voucher.asset.decimals ?? 0) ? 1 : 2,
        }),
      })
    : "";
  const values = {
    n: voucher ? amount(voucher) : "",
    unit: voucher
      ? t("unit", { count: voucher.amount === 10n ** BigInt(voucher.asset.decimals ?? 0) ? 1 : 2 })
      : "",
    amt: gd ? amount(gd) : "",
  };

  const rows = deliveries.map((d): ServiceRewardRow => {
    const status = STATUS[d.status];
    const detail =
      d.kind === "voucher"
        ? d.status === "on-the-way"
          ? t("rw.d.sending")
          : d.status === "waiting" && d.shortOf === "allowance"
            ? t("rw.r.vouShortM")
            : d.status === "waiting" || d.status === "delayed"
              ? t("rw.d.waits")
              : t("rw.d.fromReserve")
        : d.status === "on-the-way"
          ? t("rw.d.paying")
          : d.status === "delayed"
            ? t("rw.d.retrying")
            : t("rw.d.fromPool");
    return {
      id: d.id,
      kind: d.kind,
      title: d.kind === "voucher" ? vouchers : t("rw.gd", { amt: amount(d) }),
      status: { label: t(status.id), tone: status.tone },
      detail,
    };
  });

  const due = deliveries.every((d) => d.status !== "after-work");
  const all = deliveries.every((d) => d.status === "received");
  const sentence = ((): string => {
    if (!due) return OPEN.includes(input.coreState) ? t("rw.band.open") : t("rw.n.prog.b");
    if (all)
      return gd
        ? t("rw.n.done.b", values)
        : t(oneVoucher ? "rw.n.doneM.b" : "rw.n.doneV.b", values);
    // An allowance that doesn't cover the reward waits for the issuer to approve more; a short
    // reserve, for a top-up. G$ that already arrived doesn't change which.
    if (voucher?.status === "waiting") {
      const allowance = voucher.shortOf === "allowance";
      if (gd?.status === "received") return t(allowance ? "rw.n.shortMG.b" : "rw.n.short.b");
      return t(allowance ? "rw.n.shortM.b" : "rw.n.shortV.b");
    }
    // A voucher transfer that failed is never "on its way", with or without G$ beside it.
    if (voucher?.status === "delayed") return t("rw.n.delayedV.b");
    if (gd?.status === "delayed") return t("rw.n.delayed.b");
    if (voucher?.status === "received" && gd) return t("rw.n.vin.b", values);
    return gd ? t("rw.n.both.b") : t("rw.n.onWayV.b");
  })();
  const working = !due && !OPEN.includes(input.coreState);
  // The request's record and its reward terms, under Transaction details (D2).
  const terms = input.snapshot.acceptancePolicy.earned.revision;
  const tone: ServiceBandTone = working ? "attention" : all ? "kept" : due ? "waiting" : "neutral";
  const earned = input.snapshot.acceptancePolicy.earned;
  const agree =
    earned.status !== "bound" ||
    earned.claimType !== "individual" ||
    earned.modulePaused !== false ||
    input.snapshot.pause.core !== false ||
    input.snapshot.capabilities.mutation !== input.snapshot.evidence ||
    !input.snapshot.capabilities.canSignSource ||
    !input.takeUp ||
    !OPEN.includes(input.coreState)
      ? null
      : earned.revision !== null && earned.viewerConsentRevision === earned.revision
        ? "agreed"
        : input.snapshot.availableActions.includes("consentEarnedTerms")
          ? "offered"
          : null;

  return {
    rows,
    facts: [
      {
        id: "arrive",
        label: t("rw.q.arrive"),
        value: t("rw.arriveV"),
        detail: gd ? t("rw.arriveS") : t("rw.arriveSV"),
      },
      {
        id: "aside",
        label: t("rw.q.aside"),
        value: t("rw.asideV"),
        // A garden's line says "its"; anyone else's, or an issuer the wallet hasn't named yet, "their".
        detail: t(input.issuer?.kind === "collective" ? "rw.asideS" : "rw.m.asideS"),
      },
    ],
    details: [
      ...(voucher ? [t("rw.x.vou")] : []),
      ...(voucher?.receipt ? [voucher.receipt] : []),
      ...(gd ? [t("rw.x.gd")] : []),
      ...(gd?.receipt ? [gd.receipt] : []),
      ...(terms !== null
        ? [
            t("rw.x.rec", {
              id: input.snapshot.key.commitmentId.toString(),
              v: terms.toString(),
            }),
          ]
        : []),
    ],
    band: { tone, sentence, needsYou: working },
    agreementUnavailable:
      earned.status === "bound" && input.takeUp && OPEN.includes(input.coreState) && !agree
        ? { title: t("rw.n.consent.t"), body: t("rw.n.consent.b"), label: t("rw.a.help") }
        : null,
    agree,
    agreeSheet:
      agree === "offered" && voucher
        ? {
            title: t("rw.sh.title"),
            work: t("rw.sh.work"),
            vouchers: t("rw.sh.vou"),
            value: t("rw.sh.vouV", values),
            detail: t("rw.sh.vouS"),
            // An open request is the member's once taken up; a reviewed one waits for its stewards.
            consent: t(
              input.takeUp === "service"
                ? "rw.sh.consentService"
                : input.takeUp === "open"
                  ? "rw.sh.consentOpen"
                  : "rw.sh.consent"
            ),
            cta: t(input.takeUp === "service" ? "rw.sh.title" : "rw.sh.cta"),
          }
        : null,
    vouchersReceived: voucher?.status === "received",
  };
}
