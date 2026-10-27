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
   * Agreeing to a voucher reward on the source network stays operator-assisted, so the page
   * says so with one door instead of an act that can't be signed here.
   */
  agreementUnavailable: { title: string; body: string; label: string } | null;
  /** The vouchers arrived, so the reader can go to them: See Your Vouchers. */
  vouchersReceived: boolean;
}

export interface ServiceRewardsInput {
  snapshot: ServiceAccessSnapshot;
  coreState: CommitmentDerivedState;
  /** The voucher reward's issuer, from the voucher wallet's directory. */
  issuer: Pick<VoucherIssuer, "name" | "gender"> | null;
  /** The request's garden, whose pool pays any G$. */
  garden: string;
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
    if (all) return gd ? t("rw.n.done.b", values) : t("rw.n.doneV.b", values);
    if (voucher?.status === "waiting")
      return gd?.status === "received" ? t("rw.n.short.b") : t("rw.n.shortV.b");
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

  return {
    rows,
    facts: [
      {
        id: "arrive",
        label: t("rw.q.arrive"),
        value: t("rw.arriveV"),
        detail: gd ? t("rw.arriveS") : t("rw.arriveSV"),
      },
      { id: "aside", label: t("rw.q.aside"), value: t("rw.asideV"), detail: t("rw.asideS") },
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
      earned.status === "bound" && OPEN.includes(input.coreState)
        ? { title: t("rw.n.consent.t"), body: t("rw.n.consent.b"), label: t("rw.a.help") }
        : null,
    vouchersReceived: voucher?.status === "received",
  };
}
