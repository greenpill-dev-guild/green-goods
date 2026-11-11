import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import type { VoucherAwardRecord } from "@green-goods/shared/public-contracts/voucher-awards";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminTextField } from "@/components/AdminTextField";
import { voucherAmountWords } from "./voucherPresentation";

/** Each award state in its own tone, so pending, uncertain and delivered never read alike. */
export const AWARD_STATE_TONE: Record<
  VoucherAwardRecord["state"],
  "warning" | "info" | "error" | "success"
> = {
  awaiting_authorization: "warning",
  submitted: "info",
  failed: "error",
  needs_reconciliation: "warning",
  confirmed: "success",
};

/**
 * The Safe's own identifiers, folded under one line: a steward checks them when something is
 * wrong, not every time they read who gets what.
 */
export function SafeDetails({
  label,
  rows,
  link,
}: {
  label: string;
  rows: readonly (readonly [string, string])[];
  link?: { href: string; label: string } | null;
}) {
  return (
    <details
      className="rounded-(--gg-row-radius) border border-stroke-soft"
      data-component="VoucherAwardSafeDetails"
    >
      <summary className="flex min-h-11 cursor-pointer items-center px-3 type-label text-text-sub">
        {label}
      </summary>
      <div className="space-y-2 px-3 pb-3">
        <FactList frame="inset">
          {rows.map(([term, value]) => (
            <FactRow
              key={term}
              label={term}
              value={<span className="break-all font-mono type-meta">{value}</span>}
            />
          ))}
        </FactList>
        {link ? (
          <a
            className="inline-block type-meta underline underline-offset-2"
            href={link.href}
            target="_blank"
            rel="noreferrer"
          >
            {link.label}
          </a>
        ) : null}
      </div>
    </details>
  );
}

/**
 * One award as its record stands: its state first, then who gets how many of whose vouchers and
 * for what, the Safe's details folded away, and the acts that move it on, end-aligned.
 */
export function VoucherAwardRecordView({
  record,
  decimals,
  issuerName,
  disabled,
  recovered,
  uncertain,
  directSigningAvailable,
  onSend,
  onRecover,
  onReconcile,
}: {
  record: VoucherAwardRecord;
  decimals: number;
  /** Whose vouchers these are, for the amount's words ("2 Tech and Sun vouchers"). */
  issuerName: string;
  disabled: boolean;
  recovered: boolean;
  uncertain: boolean;
  directSigningAvailable: boolean;
  onSend: () => void;
  onRecover: () => void;
  onReconcile: (hash: `0x${string}`) => void;
}) {
  const intl = useIntl();
  const t = (key: string) => intl.formatMessage({ id: `cockpit.voucherAward.${key}` });
  const [hash, setHash] = useState(record.transactionHash ?? "");
  const [consent, setConsent] = useState(false);
  const confirmed = record.state === "confirmed";
  const canSend =
    recovered &&
    !uncertain &&
    directSigningAvailable &&
    record.safe.threshold === 1 &&
    (record.state === "awaiting_authorization" ||
      (record.state === "failed" && record.failure === "transaction_reverted"));
  const safeRows: (readonly [string, string])[] = [
    [t("token"), record.award.token],
    [t("reserve"), record.safe.safe],
    [t("nonce"), record.safe.nonce],
    [t("threshold"), String(record.safe.threshold)],
    [t("safeHash"), record.safe.safeTxHash],
    ...(record.transactionHash ? [[t("transaction"), record.transactionHash] as const] : []),
  ];
  return (
    <div className="space-y-3" data-component="VoucherAwardRecord" data-state={record.state}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge size="sm" variant={AWARD_STATE_TONE[record.state]}>
          {t(`state.${record.state}`)}
        </StatusBadge>
      </div>
      {uncertain && !confirmed ? <Alert variant="warning">{t("pending")}</Alert> : null}
      <FactList frame="inset">
        <FactRow
          label={t("recipient")}
          value={<AddressDisplay address={record.award.recipient} />}
        />
        <FactRow
          label={t("amount")}
          value={voucherAmountWords(
            intl.formatMessage,
            BigInt(record.award.amount),
            decimals,
            issuerName
          )}
        />
        <FactRow label={t("reason")} value={record.award.reason} />
        <FactRow label={t("reference")} value={record.award.reference ?? "—"} />
      </FactList>
      <SafeDetails
        label={t("safeDetails")}
        rows={safeRows}
        link={
          record.transactionHash
            ? {
                href: `https://gnosisscan.io/tx/${record.transactionHash}`,
                label: t("viewTransaction"),
              }
            : null
        }
      />
      {confirmed ? (
        // Where the recipient sees the delivered award, so the steward can say so when asked.
        <p className="type-meta text-text-soft">{t("recipientFinds")}</p>
      ) : (
        <>
          <p className="type-meta text-text-soft">{t("handoffHelp")}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              emphasis="secondary"
              size="sm"
              disabled={disabled}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    JSON.stringify({ award: record.award, safe: record.safe }, null, 2)
                  );
                  toastService.success({ message: t("copied") });
                } catch (error) {
                  toastService.error({ message: t("error"), error });
                }
              }}
            >
              {t("handoff")}
            </Button>
            <Button
              type="button"
              emphasis="secondary"
              size="sm"
              disabled={disabled}
              onClick={onRecover}
            >
              {t("recover")}
            </Button>
          </div>
          {canSend ? (
            <div className="space-y-2">
              <label className="flex items-start gap-2 type-body text-text-strong">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={consent}
                  disabled={disabled}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                {t("consent")}
              </label>
              <div className="flex justify-end">
                <Button type="button" size="sm" disabled={disabled || !consent} onClick={onSend}>
                  {t("send")}
                </Button>
              </div>
            </div>
          ) : null}
          <AdminTextField
            label={t("transaction")}
            value={hash}
            disabled={disabled}
            onChange={(event) => setHash(event.target.value)}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              emphasis="secondary"
              size="sm"
              disabled={disabled || !/^0x[\da-f]{64}$/i.test(hash)}
              onClick={() => onReconcile(hash as `0x${string}`)}
            >
              {t("reconcile")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
