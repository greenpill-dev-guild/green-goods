import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import type {
  VoucherAwardInput,
  VoucherAwardRecord,
} from "@green-goods/shared/public-contracts/voucher-awards";
import { parseVoucherAmount } from "@green-goods/shared/modules/commitment-pooling/pool-console";
import { useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, isAddress, type Address } from "viem";
import { AdminDialog } from "@/components/AdminDialog";
import { AdminTextField } from "@/components/AdminTextField";
import { VoucherAwardRecordView } from "./VoucherAwardRecordView";

export interface VoucherAwardDialogProps {
  issuer: { name: string; decimals: number; token: Address; reserve: Address };
  records: readonly VoucherAwardRecord[];
  busy: boolean;
  disabled: boolean;
  directSigningAvailable: boolean;
  isLimited?: boolean;
  onClose: () => void;
  onLoad: () => Promise<unknown>;
  onPrepare: (award: VoucherAwardInput) => Promise<VoucherAwardRecord>;
  onSend: (
    record: VoucherAwardRecord
  ) => Promise<{ record: VoucherAwardRecord; operation: { status: string } | null }>;
  onRecover: VoucherAwardDialogProps["onSend"];
  onReconcile: (
    record: VoucherAwardRecord,
    transactionHash: `0x${string}`
  ) => Promise<VoucherAwardRecord>;
}

/** Review first; preparing records the exact Safe call, and only a verified receipt completes it. */
export function VoucherAwardDialog(props: VoucherAwardDialogProps) {
  const { issuer, records, busy, disabled, onClose } = props;
  const intl = useIntl();
  const t = (key: string) => intl.formatMessage({ id: `cockpit.voucherAward.${key}` });
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [review, setReview] = useState<VoucherAwardInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [recovered, setRecovered] = useState<Record<string, boolean>>({});
  const [uncertain, setUncertain] = useState<Record<string, boolean>>({});
  const quantity = parseVoucherAmount(amount, issuer.decimals);
  const valid =
    quantity !== null &&
    quantity > 0n &&
    isAddress(recipient) &&
    !/^0x0{40}$/i.test(recipient) &&
    recipient.toLowerCase() !== issuer.reserve.toLowerCase() &&
    reason.trim().length > 0 &&
    reason.length <= 240 &&
    reference.length <= 200;
  const blocked = disabled || busy;
  const act = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      const key = [
        "not_authorized",
        "insufficient_reserve",
        "safe_nonce_claimed",
        "safe_nonce_changed",
        "submission_unresolved",
      ].includes(code)
        ? code
        : "error";
      setError(key);
      setRecovered({});
      toastService.error({ message: t(key), error: cause });
    }
  };
  const execute = (record: VoucherAwardRecord, recover: boolean) =>
    act(async () => {
      const result = await (recover ? props.onRecover(record) : props.onSend(record));
      const pending =
        result.record.state !== "confirmed" &&
        result.operation !== null &&
        ["submitted", "unresolved", "awaiting-approval"].includes(result.operation.status);
      setUncertain((old) => ({ ...old, [record.award.awardId]: pending }));
      setRecovered((old) => ({ ...old, [record.award.awardId]: true }));
      toastService.show({
        status: result.record.state === "confirmed" ? "success" : "info",
        message: t(result.record.state === "confirmed" ? "confirmed" : "pending"),
      });
    });
  return (
    <AdminDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("title")}
      target={issuer.name}
      description={t("help")}
      size="lg"
      tone="garden"
      preventClose={busy}
    >
      <div className="space-y-4">
        <Button
          type="button"
          emphasis="secondary"
          disabled={blocked}
          onClick={() => void act(props.onLoad)}
        >
          {t("load")}
        </Button>
        {props.isLimited ? (
          <p role="status" className="type-meta text-text-soft">
            {t("limited")}
          </p>
        ) : null}
        {records.length ? (
          <ul className="divide-y divide-stroke-soft">
            {records.map((record) => (
              <li key={record.award.awardId} className="py-2">
                <Button
                  type="button"
                  emphasis="tertiary"
                  onClick={() => setActiveId(record.award.awardId)}
                >
                  {record.award.reason} ·{" "}
                  {formatUnits(BigInt(record.award.amount), issuer.decimals)} {issuer.name} ·{" "}
                  {t(record.state)}
                </Button>
                {activeId === record.award.awardId ? (
                  <VoucherAwardRecordView
                    record={record}
                    decimals={issuer.decimals}
                    disabled={blocked}
                    uncertain={uncertain[record.award.awardId] ?? false}
                    recovered={recovered[record.award.awardId] ?? false}
                    directSigningAvailable={props.directSigningAvailable}
                    onSend={() => void execute(record, false)}
                    onRecover={() => void execute(record, true)}
                    onReconcile={(hash) =>
                      void act(async () => {
                        const result = await props.onReconcile(record, hash);
                        setUncertain((old) => ({
                          ...old,
                          [record.award.awardId]: result.state !== "confirmed",
                        }));
                        toastService.info({ message: t(result.state) });
                      })
                    }
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-meta text-text-soft">{t("empty")}</p>
        )}
        <h4 className="type-title-sm">{t("new")}</h4>
        {review ? (
          <div className="space-y-3">
            <FactList frame="inset">
              {[
                [t("recipient"), review.recipient],
                [
                  t("amount"),
                  `${formatUnits(BigInt(review.amount), issuer.decimals)} ${issuer.name}`,
                ],
                [t("token"), issuer.token],
                [t("reserve"), issuer.reserve],
                [t("reason"), review.reason],
                [t("reference"), review.reference ?? "—"],
              ].map(([label, value]) => (
                <FactRow
                  key={label}
                  label={label}
                  value={<span className="break-all">{value}</span>}
                />
              ))}
            </FactList>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                emphasis="secondary"
                disabled={blocked}
                onClick={() => setReview(null)}
              >
                {t("edit")}
              </Button>
              <Button
                type="button"
                disabled={blocked}
                onClick={() =>
                  void act(async () => {
                    const saved = await props.onPrepare(review);
                    setActiveId(saved.award.awardId);
                    setRecovered((old) => ({ ...old, [saved.award.awardId]: true }));
                    setReview(null);
                    setRecipient("");
                    setAmount("");
                    setReason("");
                    setReference("");
                    toastService.success({ message: t("prepared") });
                  })
                }
              >
                {t("prepare")}
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (valid)
                setReview({
                  awardId: crypto.randomUUID(),
                  reserve: issuer.reserve,
                  token: issuer.token,
                  recipient: recipient as Address,
                  amount: quantity!.toString(),
                  reason: reason.trim(),
                  reference: reference.trim() || null,
                });
            }}
          >
            <AdminTextField
              label={t("recipient")}
              required
              value={recipient}
              disabled={blocked}
              onChange={(event) => setRecipient(event.target.value)}
            />
            <AdminTextField
              label={t("amount")}
              required
              value={amount}
              disabled={blocked}
              onChange={(event) => setAmount(event.target.value)}
              inputProps={{ inputMode: "decimal" }}
            />
            <AdminTextField
              label={t("reason")}
              required
              value={reason}
              disabled={blocked}
              onChange={(event) => setReason(event.target.value)}
              inputProps={{ maxLength: 240 }}
            />
            <AdminTextField
              label={t("reference")}
              value={reference}
              disabled={blocked}
              onChange={(event) => setReference(event.target.value)}
              inputProps={{ maxLength: 200 }}
            />
            <Button type="submit" disabled={blocked || !valid}>
              {t("review")}
            </Button>
          </form>
        )}
        {error ? (
          <p role="alert" className="type-meta text-text-soft">
            {t(error)}
          </p>
        ) : null}
      </div>
    </AdminDialog>
  );
}
