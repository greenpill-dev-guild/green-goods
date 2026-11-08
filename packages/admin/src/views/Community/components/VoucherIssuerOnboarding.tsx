import {
  SERVICE_ISSUER_ROUTES,
  type ServiceIssuerDraft,
  type ServiceIssuerDraftRecord,
  type ServiceIssuerListings,
  type ServiceIssuerRoute,
  type ServiceIssuerDeskRecord,
  useServiceIssuerDesk,
  useServiceIssuerListings,
} from "@green-goods/shared/commitment-pooling";
import { Button } from "@green-goods/shared/components/Button";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { type ReactNode, useState } from "react";
import { Alert } from "@green-goods/shared/components/Alert";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { AdminSelect } from "@/components/AdminTextField";
import { VoucherIssuerDraftEditor } from "./VoucherIssuerDraftEditor";
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
  /** Each reviewed token's admission and holding limit in its selected pool. */
  listings?: ServiceIssuerListings;
  onSend?: (draft: ServiceIssuerDraft) => void;
  onRemind?: (draft: ServiceIssuerDraft) => void;
  onEdit?: (draft: ServiceIssuerDraft) => void;
  toolbar?: ReactNode;
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
  const intl = useIntl();
  const t = (key: string) => intl.formatMessage({ id: `cockpit.community.voucherDesk.${key}` });
  const choices = SERVICE_ISSUER_ROUTES.flatMap((route) =>
    route.pools.map((pool) => ({ route, pool, key: `${route.service.id}:${pool.id}` }))
  );
  const [selected, setSelected] = useState(choices[0]?.key ?? "");
  const active = choices.find((choice) => choice.key === selected);
  const desk = useServiceIssuerDesk(
    active ? { routeId: active.route.service.id, poolId: active.pool.id } : null
  );
  const [editing, setEditing] = useState<ServiceIssuerDeskRecord | "new" | null>(null);
  const listings = useServiceIssuerListings();
  const failed = desk.save.isError || desk.send.isError;
  const edit = (draft: ServiceIssuerDraft) => {
    const record = desk.records.find((r) => r.draft.id === draft.id);
    if (record) setEditing(record);
  };
  const send = async (draft: ServiceIssuerDraft) => {
    const record = desk.records.find((r) => r.draft.id === draft.id);
    if (!canPrepare || desk.send.isPending || !record || record.draft.sentAt !== null) return;
    try {
      await desk.send.mutateAsync(record);
      toastService.success({ title: t("sent") });
    } catch {
      toastService.error({ title: t("failed") });
    }
  };
  return (
    <>
      <VoucherIssuerCard
        canPrepare={canPrepare}
        routes={active ? [{ ...active.route, pools: [active.pool] }] : []}
        drafts={desk.records}
        listings={listings.data}
        onEdit={edit}
        onSend={(draft) => void send(draft)}
        toolbar={
          <div className="space-y-3">
            <AdminSelect
              label={t("pool")}
              value={selected}
              disabled={desk.save.isPending || desk.send.isPending}
              onChange={(event) => {
                setSelected(event.target.value);
                setEditing(null);
              }}
            >
              {choices.map((choice) => (
                <option key={choice.key} value={choice.key}>
                  {choice.pool.name}
                </option>
              ))}
            </AdminSelect>
            <p className="type-meta text-text-soft">{t("help")}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                emphasis="secondary"
                disabled={!canPrepare || !active || desk.load.isPending}
                onClick={() => void desk.load.mutateAsync().catch(() => {})}
              >
                {t("load")}
              </Button>
              <Button
                type="button"
                disabled={!canPrepare || !active}
                onClick={() => setEditing("new")}
              >
                {t("create")}
              </Button>
            </div>
            {desk.load.isError || failed ? (
              <Alert variant="error">{t(desk.load.isError ? "loadFailed" : "failed")}</Alert>
            ) : null}
            {desk.isLimited ? (
              <p role="status" className="type-meta text-text-soft">
                {t("limit")}
              </p>
            ) : null}
          </div>
        }
      />
      {editing && active ? (
        <VoucherIssuerDraftEditor
          key={`${active.key}:${editing === "new" ? "new" : `${editing.draft.id}:${editing.revision}`}`}
          route={active.route}
          pool={active.pool}
          record={editing === "new" ? undefined : editing}
          pending={desk.save.isPending}
          onClose={() => setEditing(null)}
          onSave={async (draft) => {
            if (!canPrepare) throw new Error("Steward permission required");
            try {
              await desk.save.mutateAsync({
                draft,
                expectedRevision: editing === "new" ? null : editing.revision,
              });
              toastService.success({ title: t("saved") });
            } catch (error) {
              toastService.error({ title: t("failed") });
              throw error;
            }
          }}
        />
      ) : null}
    </>
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
  onEdit,
  toolbar,
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
        row.pool === open.row.pool &&
        row.policy === open.row.policy &&
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
      {toolbar}
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
                    {row.pool ? `${row.pool.name} · ` : ""}
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
                  {onEdit && row.record ? (
                    <Button
                      type="button"
                      size="sm"
                      emphasis="tertiary"
                      disabled={!canPrepare}
                      onClick={() => onEdit(row.record!.draft)}
                    >
                      {intl.formatMessage({ id: "cockpit.community.voucherDesk.edit" })}
                    </Button>
                  ) : null}
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
