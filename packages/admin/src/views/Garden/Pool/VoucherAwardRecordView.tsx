import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import type { VoucherAwardRecord } from "@green-goods/shared/public-contracts/voucher-awards";
import { useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits } from "viem";
import { AdminTextField } from "@/components/AdminTextField";

export function VoucherAwardRecordView({
  record,
  decimals,
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
  return (
    <div className="space-y-3">
      <FactList frame="inset">
        {[
          [t("recipient"), record.award.recipient],
          [t("amount"), formatUnits(BigInt(record.award.amount), decimals)],
          [t("token"), record.award.token],
          [t("reserve"), record.safe.safe],
          [t("reason"), record.award.reason],
          [t("reference"), record.award.reference ?? "—"],
          [t("nonce"), record.safe.nonce],
          [t("threshold"), String(record.safe.threshold)],
          [t("safeHash"), record.safe.safeTxHash],
        ].map(([label, value]) => (
          <FactRow key={label} label={label} value={<span className="break-all">{value}</span>} />
        ))}
      </FactList>
      <p role="status" className="type-meta text-text-soft">
        {t(confirmed ? "confirmed" : uncertain ? "pending" : record.state)}
      </p>
      {record.transactionHash ? (
        <a
          className="break-all underline"
          href={`https://gnosisscan.io/tx/${record.transactionHash}`}
          target="_blank"
          rel="noreferrer"
        >
          {record.transactionHash}
        </a>
      ) : null}
      {!confirmed ? (
        <>
          <p className="type-meta text-text-soft">{t("handoffHelp")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              emphasis="secondary"
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
            <Button type="button" emphasis="secondary" disabled={disabled} onClick={onRecover}>
              {t("recover")}
            </Button>
          </div>
          {canSend ? (
            <>
              <label className="flex items-start gap-2 type-meta">
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={disabled}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                {t("consent")}
              </label>
              <Button type="button" disabled={disabled || !consent} onClick={onSend}>
                {t("send")}
              </Button>
            </>
          ) : null}
          <AdminTextField
            label={t("transaction")}
            value={hash}
            disabled={disabled}
            onChange={(event) => setHash(event.target.value)}
          />
          <Button
            type="button"
            emphasis="secondary"
            disabled={disabled || !/^0x[\da-f]{64}$/i.test(hash)}
            onClick={() => onReconcile(hash as `0x${string}`)}
          >
            {t("reconcile")}
          </Button>
        </>
      ) : null}
    </div>
  );
}
