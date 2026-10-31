import {
  SERVICE_ISSUER_ROUTES,
  type ServiceIssuerDraft,
  type ServiceIssuerDraftRecord,
  type ServiceIssuerListings,
  type ServiceIssuerRoute,
  useServiceIssuerDrafts,
  useServiceIssuerListings,
} from "@green-goods/shared/commitment-pooling";
import { Button } from "@green-goods/shared/components/Button";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits } from "viem";
import { VoucherIssuerDialog, type VoucherIssuerDialogKind } from "./VoucherIssuerDialogs";
import {
  type VoucherIssuerRow,
  type VoucherIssuerStatus,
  voucherIssuerRows,
} from "./voucherIssuerRows";

interface Props {
  canPrepare: boolean;
  routes?: readonly ServiceIssuerRoute[];
  rehearsal?: boolean;
  /** Member drafts from the stewards' draft desk; none exists before the first onboarding. */
  drafts?: readonly ServiceIssuerDraftRecord[];
  /** Each reviewed token's admission and holding limit in the shared pool. */
  listings?: ServiceIssuerListings;
  onSend?: (draft: ServiceIssuerDraft) => void;
  onRemind?: (draft: ServiceIssuerDraft) => void;
}

const PILL: Record<VoucherIssuerStatus, "success" | "warning" | "info" | "neutral"> = {
  draft: "neutral",
  waiting: "warning",
  changed: "warning",
  declined: "neutral",
  approved: "info",
  setup: "info",
  listed: "success",
  delisted: "neutral",
  unread: "neutral",
};

/** The card in the protocol garden's Community, Coordination, on the live reads. */
export function VoucherIssuerOnboarding({ canPrepare }: { canPrepare: boolean }) {
  const drafts = useServiceIssuerDrafts();
  const listings = useServiceIssuerListings();
  return (
    <VoucherIssuerCard
      canPrepare={canPrepare}
      drafts={drafts.data?.status === "observed" ? drafts.data.records : []}
      listings={listings.data}
    />
  );
}

/**
 * Command: stewards prepare a member's draft, wait for the member's own signed approval, copy
 * the owner Safe drafts that list the token, and prepare its delisting. Nothing here sends a
 * transaction or stands in for a member's approval.
 */
export function VoucherIssuerCard({
  canPrepare,
  routes = SERVICE_ISSUER_ROUTES,
  rehearsal = false,
  drafts = [],
  listings,
  onSend,
  onRemind,
}: Props) {
  const intl = useIntl();
  const text = (key: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: `cockpit.community.voucherIssuers.${key}` }, values);
  const [open, setOpen] = useState<{ row: VoucherIssuerRow; kind: VoucherIssuerDialogKind } | null>(
    null
  );
  const rows = voucherIssuerRows(routes, drafts, listings);
  // A changed catalog closes an open dialog instead of exporting an obsolete configuration.
  const current =
    open &&
    rows.find(
      (row) =>
        row.key === open.row.key &&
        row.route === open.row.route &&
        row.asset === open.row.asset &&
        row.record === open.row.record
    );
  const date = (seconds: bigint | null) =>
    seconds === null
      ? ""
      : intl.formatDate(Number(seconds) * 1000, { month: "short", day: "numeric" });
  const describe = (row: VoucherIssuerRow) => {
    const draft = row.record?.draft;
    const name = draft?.memberName ?? row.asset?.name ?? "";
    const service = draft?.terms.service.title ?? row.asset?.service.unit ?? text("unconfirmed");
    const pool = (value: bigint | undefined) =>
      row.asset && value !== undefined ? formatUnits(value, row.asset.decimals) : "";
    // A member's reviewed record exists only after their approval, so its setup reads as approved.
    const status =
      row.status === "changed"
        ? "waiting"
        : row.status === "setup" && row.kind === "individual"
          ? "approved"
          : row.status;
    return {
      name,
      title: row.asset?.name ?? draft?.terms.token.name ?? "",
      pill: text(`st.${status}`, { name }),
      meta: text(`m.${row.status}`, {
        service,
        name,
        date: date(
          row.status === "declined"
            ? (row.record?.declinedAt ?? null)
            : row.status === "approved"
              ? (row.record?.approval?.signedAt ?? null)
              : (draft?.sentAt ?? null)
        ),
        holding: pool(row.listing?.holding),
        cap: pool(row.listing?.limit),
      }),
    };
  };
  const acts = (row: VoucherIssuerRow, name: string): [string, VoucherIssuerDialogKind][] => {
    switch (row.status) {
      case "draft":
        return [[text("a.prepare"), "prepare"]];
      case "waiting":
      case "changed":
        return [[text("a.remind", { name }), "awaiting"]];
      case "declined":
        return [[text("review"), "prepare"]];
      case "approved":
        return [[text("a.approval"), "approval"]];
      case "setup":
        return [[text("a.drafts"), "drafts"]];
      case "listed":
        return row.kind === "individual"
          ? [
              [text("review"), "review"],
              [text("a.delist"), "delist"],
            ]
          : [[text("review"), "review"]];
      default:
        return [[text("review"), "review"]];
    }
  };
  return (
    <section
      className="surface-section space-y-3"
      aria-label={text("title")}
      data-component="VoucherIssuerOnboarding"
    >
      <h3 className="type-title-sm text-text-strong">{text("title")}</h3>
      <p className="type-meta text-text-soft">{text("help")}</p>
      {rehearsal ? (
        <p role="status" className="type-meta text-text-soft">
          {text("fictional")}
        </p>
      ) : null}
      {!rows.length ? (
        <p role="status" className="type-meta text-text-soft">
          {text("empty")}
        </p>
      ) : (
        <ul className="divide-y divide-stroke-soft">
          {rows.map((row) => {
            const view = describe(row);
            return (
              <li
                key={row.key}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
                data-status={row.status}
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate type-body font-medium text-text-strong" title={view.title}>
                    {view.title}
                  </p>
                  <p className="type-meta text-text-soft">
                    {text(row.kind)} · {view.meta}
                  </p>
                  <StatusBadge size="sm" variant={PILL[row.status]} showIcon={false}>
                    {view.pill}
                  </StatusBadge>
                </div>
                <div className="ml-auto flex flex-col items-end gap-1">
                  {acts(row, view.name).map(([label, kind], index) => (
                    <Button
                      key={kind}
                      data-act={kind}
                      type="button"
                      emphasis={index === 0 ? "secondary" : "tertiary"}
                      tone={kind === "delist" ? "danger" : undefined}
                      size="sm"
                      disabled={!canPrepare}
                      onClick={() => setOpen({ row, kind })}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {!canPrepare ? <p className="type-meta text-text-soft">{text("stewardOnly")}</p> : null}
      {current && open ? (
        <VoucherIssuerDialog
          key={`${current.key}:${open.kind}`}
          row={current}
          kind={open.kind}
          canPrepare={canPrepare}
          rehearsal={rehearsal}
          onClose={() => setOpen(null)}
          onSend={onSend}
          onRemind={onRemind}
        />
      ) : null}
    </section>
  );
}
