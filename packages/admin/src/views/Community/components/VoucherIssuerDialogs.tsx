import {
  type ServiceIssuerDraft,
  serviceIssuerApprovalProvenance,
  serviceIssuerDelistingDraft,
  serviceIssuerGovernanceDrafts,
  serviceIssuerTermsDigest,
  useIssuerSafeThreshold,
} from "@green-goods/shared/commitment-pooling";
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { RiCheckLine } from "@remixicon/react";
import { type ReactNode, useState } from "react";
import { useIntl } from "react-intl";
import { encodeFunctionData, formatUnits } from "viem";
import { AdminDialog } from "@/components/AdminDialog";
import { AdminTextArea } from "@/components/AdminTextField";
import type { VoucherIssuerRow } from "./voucherIssuerRows";

export type VoucherIssuerDialogKind =
  | "prepare"
  | "awaiting"
  | "approval"
  | "drafts"
  | "delist"
  | "review";

interface Props {
  row: VoucherIssuerRow;
  kind: VoucherIssuerDialogKind;
  canPrepare: boolean;
  rehearsal: boolean;
  onClose: () => void;
  onSend?: (draft: ServiceIssuerDraft) => void;
  onRemind?: (draft: ServiceIssuerDraft) => void;
}

/** The pool's price index and fee policy both count in millionths. */
const MILLIONTHS = 6;

/**
 * Each issuer state's dialog. Everything a steward does here prepares or copies; copying sends
 * nothing and is no member's signature, and the dialog says so once it has copied.
 */
export function VoucherIssuerDialog({
  row,
  kind,
  canPrepare,
  rehearsal,
  onClose,
  onSend,
  onRemind,
}: Props) {
  const intl = useIntl();
  const t = (key: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: `cockpit.community.voucherIssuers.${key}` }, values);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [reason, setReason] = useState("");
  const { route, asset, record } = row;
  const draft = record?.draft;
  const name = draft?.memberName ?? asset?.name ?? "";
  const safe = useIssuerSafeThreshold({ chainId: 100, safe: route?.pool.limiter.owner }).data;
  const safeNote =
    safe?.status === "observed" && safe.threshold !== null && safe.owners !== null
      ? t("safe.needs", { threshold: safe.threshold, owners: safe.owners })
      : t("safe.unread");
  const date = (seconds: bigint) =>
    intl.formatDate(Number(seconds) * 1000, { month: "short", day: "numeric", year: "numeric" });
  const units = (value: bigint | null, decimals: number, symbol: string) =>
    value === null ? t("unconfirmed") : `${formatUnits(value, decimals)} ${symbol}`;
  let drafts: ReturnType<typeof serviceIssuerGovernanceDrafts> | null = null;
  if (route && asset && (kind === "drafts" || kind === "delist")) {
    try {
      drafts =
        kind === "delist"
          ? [serviceIssuerDelistingDraft(route, asset.id)]
          : serviceIssuerGovernanceDrafts(route, asset.id);
    } catch {
      /* Incomplete reviewed metadata must remain unavailable. */
    }
  }
  const copy = async (value: unknown) => {
    if (!canPrepare || rehearsal) return;
    setCopied(false);
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      setCopied(true);
    } catch {
      setCopyFailed(true);
    }
  };
  const safeCalls = () =>
    drafts!.map(({ purpose, owner, call }) => ({
      purpose,
      owner,
      chainId: call.chainId,
      to: call.address,
      value: "0",
      data: encodeFunctionData({ abi: call.abi, functionName: call.functionName, args: call.args }),
    }));
  // Addresses, hashes and calls wrap anywhere; words wrap between words.
  const facts = (rows: [string, ReactNode][]) => (
    <FactList frame="inset">
      {rows.map(([label, value]) => (
        <FactRow
          key={label}
          label={label}
          value={
            typeof value === "string" && !/^0x|^issuer-approval:|^https?:/.test(value) ? (
              value
            ) : (
              <span className="break-all">{value}</span>
            )
          }
        />
      ))}
    </FactList>
  );
  const action = (label: string, onClick: () => void, disabled = false, danger = false) => (
    <Button
      type="button"
      size="sm"
      tone={danger ? "danger" : undefined}
      disabled={!canPrepare || rehearsal || disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  );
  let title = t("reviewTitle");
  let description: ReactNode = undefined;
  let body: ReactNode = null;
  let actions: ReactNode = null;
  if (kind === "prepare" || kind === "awaiting") {
    const terms = draft!.terms;
    const decimals = terms.token.decimals;
    title = kind === "prepare" ? t("d.prepare.t", { name }) : t("d.wait.t", { name });
    description = terms.service.title;
    body =
      kind === "prepare" ? (
        <>
          {facts([
            [t("df.buys"), terms.service.buys],
            [
              t("df.capacity"),
              t("df.capacityV", {
                count: formatUnits(terms.capacity.units, decimals),
                weeks: terms.capacity.weeks,
              }),
            ],
            [
              t("df.issue"),
              t("df.issueV", {
                total: units(terms.issue.total, decimals, terms.token.symbol),
                pool: formatUnits(terms.issue.pool, decimals),
              }),
            ],
            [t("df.allowance"), units(terms.rewardAllowance, decimals, terms.token.symbol)],
            [t("df.cap"), units(terms.poolHoldingCap, decimals, terms.token.symbol)],
            [t("df.price"), formatUnits(terms.priceIndex, MILLIONTHS)],
            [
              t("df.fee"),
              intl.formatNumber(Number(formatUnits(terms.poolFee, MILLIONTHS)), {
                style: "percent",
                maximumFractionDigits: 4,
              }),
            ],
            [t("df.reply"), t("df.replyV", { days: terms.replyBusinessDays })],
            [t("df.deadline"), t("df.deadlineV", { days: terms.acceptanceDays })],
            [t("df.remedy"), terms.service.remedy],
            [t("df.terms"), t("w.termsV", { v: terms.revision })],
            [t("termsDigest"), serviceIssuerTermsDigest(draft!)],
          ])}
          <p className="type-meta text-text-soft">{t("d.prepare.note", { name })}</p>
          <Alert variant="info" title={t("f.prepare.t")}>
            {t("f.prepare.b", { name })}
          </Alert>
        </>
      ) : (
        <>
          {facts([
            [t("w.sent"), draft!.sentAt === null ? t("unconfirmed") : date(draft!.sentAt)],
            [t("w.terms"), t("w.termsV", { v: terms.revision })],
            [t("w.account"), `${name} · ${draft!.member}`],
          ])}
          <Alert variant="info" title={t("f.wait.t", { name })}>
            {t("f.wait.b")}
          </Alert>
        </>
      );
    const act = kind === "prepare" ? onSend : onRemind;
    if (act && record!.declinedAt === null && (kind === "awaiting" || draft!.sentAt === null))
      actions = action(t(kind === "prepare" ? "a.send" : "a.remindNow", { name }), () =>
        act(draft!)
      );
  } else if (kind === "approval") {
    const approval = record!.approval!;
    const provenance = serviceIssuerApprovalProvenance(approval);
    title = t("d.approved.t", { name });
    description = draft!.terms.service.title;
    body = (
      <>
        {facts([
          [t("ap.signer"), approval.member],
          [t("ap.version"), String(approval.revision)],
          [t("ap.signed"), date(approval.signedAt)],
          [t("termsDigest"), approval.termsDigest],
          [t("approval"), provenance.reference],
          [t("approvalDigest"), provenance.digest],
        ])}
        <Alert variant="info" title={t("f.approved.t")}>
          {t("f.approved.b", { name })}
        </Alert>
      </>
    );
    actions = action(
      t("a.copyRecord"),
      () =>
        void copy({
          kind: "issuer-record-approval",
          draftId: approval.draftId,
          terms: { digest: approval.termsDigest },
          approval: provenance,
        })
    );
  } else if (kind === "drafts" || kind === "delist") {
    title = kind === "drafts" ? t("d.drafts.t", { name }) : t("d.delist.t", { name });
    description = t("draftOnly");
    body = (
      <>
        {kind === "delist" ? (
          <ul className="space-y-2" data-component="VoucherIssuerDelistChecks">
            {["c.hold", "c.book", "c.ex", "c.obl"].map((key) => (
              <li key={key} className="flex items-start gap-2 type-body text-text-strong">
                <RiCheckLine
                  className="mt-0.5 h-4 w-4 shrink-0 text-success-dark"
                  aria-hidden="true"
                />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Alert variant="warning" title={t("d.pauseT")}>
            {t("pause")}
          </Alert>
        )}
        {drafts ? (
          facts(
            drafts.map((d) => [
              t(d.purpose),
              <>
                <code className="type-label-sm">{`${d.call.functionName}(${d.call.args?.map(String).join(", ")})`}</code>
                <span className="mt-0.5 block type-meta text-text-soft">
                  {t("dr.where", {
                    chain: d.call.chainId ?? t("unconfirmed"),
                    safe: d.owner,
                    target: d.call.address,
                  })}
                </span>
              </>,
            ])
          )
        ) : (
          <p role="status" className="type-meta">
            {t("incomplete")}
          </p>
        )}
        {kind === "delist" ? (
          <AdminTextArea
            label={t("reason")}
            helperText={t("reasonHint")}
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        ) : null}
        <Alert variant="info" title={t(kind === "delist" ? "f.delist.t" : "f.drafts.t")}>
          {kind === "delist" ? t("f.delist.b") : t("f.drafts.b", { name })} {safeNote}
        </Alert>
      </>
    );
    actions = action(
      t(kind === "delist" ? "a.copyDelist" : "copy"),
      () =>
        void copy({
          kind: "owner-safe-drafts",
          routeId: route!.service.id,
          assetId: asset!.id,
          ...(kind === "delist" ? { reason: reason.trim() } : {}),
          calls: safeCalls(),
        }),
      !drafts || (kind === "delist" && !reason.trim()),
      kind === "delist"
    );
  } else if (asset) {
    description = t("draftOnly");
    body = (
      <>
        {facts([
          [t("owner"), asset.ownerReserve],
          [t("sourceAuthority"), asset.sourceAuthority],
          [t("unit"), asset.service.unit ?? t("unconfirmed")],
          [t("terms"), asset.service.terms.reference ?? t("unconfirmed")],
          [t("termsDigest"), asset.service.terms.digest ?? t("unconfirmed")],
          [t("approval"), asset.service.approval.reference ?? t("unconfirmed")],
          [t("approvalDigest"), asset.service.approval.digest ?? t("unconfirmed")],
          [t("capacity"), t(asset.service.capacityConfirmed ? "confirmed" : "unconfirmed")],
          [t("supply"), units(asset.initialSupply, asset.decimals, asset.symbol)],
          [t("allowance"), units(asset.adapterAllowance, asset.decimals, asset.symbol)],
          [t("cap"), units(asset.poolHoldingCap, asset.decimals, asset.symbol)],
          [t("price"), asset.priceIndex?.toString() ?? t("unconfirmed")],
          [t("control"), asset.upgradeControl?.admin ?? t("unconfirmed")],
        ])}
        <p className="type-meta text-text-soft">{t("capacityHelp")}</p>
      </>
    );
  }
  return (
    <AdminDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      target={asset?.name ?? draft?.terms.token.name}
      description={description}
      size="lg"
      tone="community"
      actions={actions}
    >
      <div className="space-y-4" data-component="VoucherIssuerDialog" data-kind={kind}>
        {body}
        {copied ? (
          <p role="status" className="type-meta text-text-strong">
            {t(kind === "approval" ? "copiedRecord" : "copiedNothingSent")}
          </p>
        ) : null}
        {copyFailed ? (
          <p role="alert" className="type-meta text-error-dark">
            {t("copyFailed")}
          </p>
        ) : null}
      </div>
    </AdminDialog>
  );
}
