import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { SheetActions } from "@green-goods/shared/components/Dialog/SheetActions";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import type {
  VoucherAwardInput,
  VoucherAwardRecord,
} from "@green-goods/shared/public-contracts/voucher-awards";
import { parseVoucherAmount } from "@green-goods/shared/modules/commitment-pooling/pool-console";
import { useId, useState } from "react";
import { useIntl } from "react-intl";
import { isAddress, type Address } from "viem";
import { AdminDialog } from "@/components/AdminDialog";
import { AdminListRow } from "@/components/AdminListRow";
import { AdminTextField } from "@/components/AdminTextField";
import { AWARD_STATE_TONE, SafeDetails, VoucherAwardRecordView } from "./VoucherAwardRecordView";
import { voucherAmountWords } from "./voucherPresentation";

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

/** The failures the Agent names; any other reads as the act that failed. */
const SPECIFIC_FAILURES = [
  "not_authorized",
  "insufficient_reserve",
  "safe_nonce_claimed",
  "safe_nonce_changed",
  "submission_unresolved",
];

/** Which act a failure belongs to, so its notice sits beside that act. */
type FailedAct = "load" | "new" | "record";

/**
 * Review first; preparing records the exact Safe call, and only a verified receipt completes it.
 * The dialog reads as the cockpit's others: history with each award's state as a pill, the new
 * award's facts, and its acts in the pinned footer.
 */
export function VoucherAwardDialog(props: VoucherAwardDialogProps) {
  const { issuer, records, busy, disabled, onClose } = props;
  const intl = useIntl();
  const { formatMessage } = intl;
  const t = (key: string) => formatMessage({ id: `cockpit.voucherAward.${key}` });
  const formId = useId();
  const historyId = useId();
  const newId = useId();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [review, setReview] = useState<VoucherAwardInput | null>(null);
  const [error, setError] = useState<{ key: string; at: FailedAct } | null>(null);
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
  const words = (units: string) =>
    voucherAmountWords(formatMessage, BigInt(units), issuer.decimals, issuer.name);
  const act = async (action: () => Promise<unknown>, at: FailedAct, fallback = "error") => {
    setError(null);
    try {
      await action();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      const key = SPECIFIC_FAILURES.includes(code) ? code : fallback;
      setError({ key, at });
      setRecovered({});
      toastService.error({ message: t(key), error: cause });
    }
  };
  const notice = (at: FailedAct) =>
    error?.at === at ? <Alert variant="error">{t(error.key)}</Alert> : null;
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
    }, "record");
  const prepare = (award: VoucherAwardInput) =>
    act(
      async () => {
        const saved = await props.onPrepare(award);
        setActiveId(saved.award.awardId);
        setRecovered((old) => ({ ...old, [saved.award.awardId]: true }));
        setReview(null);
        setRecipient("");
        setAmount("");
        setReason("");
        setReference("");
        toastService.success({ message: t("prepared") });
      },
      "new",
      "prepareFailed"
    );
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
      actions={
        review ? (
          <SheetActions
            primary={{
              label: t("prepare"),
              disabled: blocked,
              onClick: () => void prepare(review),
            }}
            secondary={{ label: t("edit"), disabled: blocked, onClick: () => setReview(null) }}
          />
        ) : (
          <SheetActions
            primary={{
              label: t("review"),
              type: "submit",
              form: formId,
              disabled: blocked || !valid,
            }}
            secondary={{
              label: formatMessage({ id: "app.common.cancel" }),
              disabled: busy,
              onClick: onClose,
            }}
          />
        )
      }
    >
      <div className="space-y-5">
        <section className="space-y-2" aria-labelledby={historyId}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 id={historyId} className="type-title-sm text-text-strong">
              {t("history")}
            </h4>
            <Button
              type="button"
              emphasis="secondary"
              size="sm"
              disabled={blocked}
              onClick={() => void act(props.onLoad, "load", "loadFailed")}
            >
              {t("load")}
            </Button>
          </div>
          {props.isLimited ? (
            <p role="status" className="type-meta text-text-soft">
              {t("limited")}
            </p>
          ) : null}
          {notice("load")}
          {records.length ? (
            <ul className="space-y-2">
              {records.map((record) => {
                const active = activeId === record.award.awardId;
                return (
                  <li key={record.award.awardId} className="space-y-2">
                    <AdminListRow
                      current={active}
                      onClick={() => setActiveId(active ? null : record.award.awardId)}
                    >
                      <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <span className="min-w-0 flex-1">
                          <span
                            className="block truncate type-body font-medium text-text-strong"
                            title={record.award.reason}
                          >
                            {record.award.reason}
                          </span>
                          <span className="block type-meta text-text-soft">
                            {words(record.award.amount)} ·{" "}
                            {intl.formatDate(record.createdAt, { dateStyle: "medium" })}
                          </span>
                        </span>
                        <StatusBadge size="xs" variant={AWARD_STATE_TONE[record.state]}>
                          {t(`state.${record.state}`)}
                        </StatusBadge>
                      </span>
                    </AdminListRow>
                    {active ? (
                      <div className="space-y-3 rounded-(--gg-row-radius) border border-stroke-soft p-3">
                        <VoucherAwardRecordView
                          record={record}
                          decimals={issuer.decimals}
                          issuerName={issuer.name}
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
                            }, "record")
                          }
                        />
                        {notice("record")}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="type-meta text-text-soft">{t("empty")}</p>
          )}
        </section>
        <section className="space-y-2" aria-labelledby={newId}>
          <h4 id={newId} className="type-title-sm text-text-strong">
            {t("new")}
          </h4>
          {review ? (
            <div className="space-y-3">
              <FactList frame="inset">
                <FactRow
                  label={t("recipient")}
                  value={<AddressDisplay address={review.recipient} />}
                />
                <FactRow label={t("amount")} value={words(review.amount)} />
                <FactRow label={t("reason")} value={review.reason} />
                <FactRow label={t("reference")} value={review.reference ?? "—"} />
              </FactList>
              <SafeDetails
                label={t("safeDetails")}
                rows={[
                  [t("token"), issuer.token],
                  [t("reserve"), issuer.reserve],
                ]}
              />
              {notice("new")}
            </div>
          ) : (
            <form
              id={formId}
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
              {notice("new")}
            </form>
          )}
        </section>
      </div>
    </AdminDialog>
  );
}
