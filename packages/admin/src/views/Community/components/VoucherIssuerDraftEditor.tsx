import type {
  ServiceIssuerDeskRecord,
  ServiceIssuerDraft,
  ServiceIssuerPool,
  ServiceIssuerRoute,
} from "@green-goods/shared/commitment-pooling";
import { parseServiceIssuerDraft } from "@green-goods/shared/modules/commitment-pooling/service-issuer-desk-protocol";
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { useId, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";
import { AdminDialog } from "@/components/AdminDialog";
import { AdminTextArea, AdminTextField } from "@/components/AdminTextField";

const FIELDS = [
  "member",
  "memberName",
  "service",
  "buys",
  "scope",
  "remedy",
  "unit",
  "tokenName",
  "tokenSymbol",
  "capacity",
  "weeks",
  "total",
  "inventory",
  "allowance",
  "cap",
  "price",
  "fee",
  "reply",
  "acceptance",
  "reference",
  "digest",
] as const;
type Fields = Record<(typeof FIELDS)[number], string>;
const MULTILINE = new Set<string>(["buys", "scope", "remedy"]);
function fieldsFrom(draft?: ServiceIssuerDraft): Fields {
  const empty = Object.fromEntries(FIELDS.map((key) => [key, key === "fee" ? "0" : ""])) as Fields;
  if (!draft) return empty;
  const t = draft.terms;
  return {
    member: draft.member,
    memberName: draft.memberName,
    service: t.service.title,
    buys: t.service.buys,
    scope: t.service.scope,
    remedy: t.service.remedy,
    unit: t.service.unit,
    tokenName: t.token.name,
    tokenSymbol: t.token.symbol,
    capacity: formatUnits(t.capacity.units, 6),
    weeks: String(t.capacity.weeks),
    total: formatUnits(t.issue.total, 6),
    inventory: formatUnits(t.issue.pool, 6),
    allowance: formatUnits(t.rewardAllowance, 6),
    cap: formatUnits(t.poolHoldingCap, 6),
    price: formatUnits(t.priceIndex, 6),
    fee: formatUnits(t.poolFee, 4),
    reply: String(t.replyBusinessDays),
    acceptance: String(t.acceptanceDays),
    reference: t.document.reference,
    digest: t.document.digest,
  };
}
function quantity(value: string, decimals = 6): bigint {
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(value))
    throw new Error("Invalid quantity");
  return parseUnits(value, decimals);
}
function whole(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) throw new Error("Invalid duration");
  return Number(value);
}
interface Props {
  route: ServiceIssuerRoute;
  pool: ServiceIssuerPool;
  record?: ServiceIssuerDeskRecord;
  draftId?: string;
  pending?: boolean;
  onSave(draft: ServiceIssuerDraft): Promise<void>;
  onClose(): void;
}

/** Edits one pool's proposed service terms; review precedes every durable save. */
export function VoucherIssuerDraftEditor({
  route,
  pool,
  record,
  draftId,
  pending = false,
  onSave,
  onClose,
}: Props) {
  const intl = useIntl();
  const t = (key: string) => intl.formatMessage({ id: `cockpit.community.voucherDesk.${key}` });
  const formId = useId();
  const [id] = useState(() => record?.draft.id ?? draftId ?? `service-${crypto.randomUUID()}`);
  const [fields, setFields] = useState(() => fieldsFrom(record?.draft));
  const [reviewed, setReviewed] = useState<ServiceIssuerDraft | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [failed, setFailed] = useState(false);
  const review = () => {
    try {
      const draft = parseServiceIssuerDraft({
        version: 1,
        id,
        member: fields.member.trim(),
        memberName: fields.memberName.trim(),
        preparedBy: record?.draft.preparedBy ?? pool.deployment.owner,
        garden: pool.garden,
        sourceChainId: route.service.sourceChainId,
        sentAt: null,
        changed: [],
        terms: {
          revision: (record?.draft.terms.revision ?? 0) + 1,
          service: {
            title: fields.service.trim(),
            buys: fields.buys.trim(),
            scope: fields.scope.trim(),
            remedy: fields.remedy.trim(),
            unit: fields.unit.trim(),
          },
          token: { name: fields.tokenName.trim(), symbol: fields.tokenSymbol.trim(), decimals: 6 },
          capacity: { units: quantity(fields.capacity), weeks: whole(fields.weeks) },
          issue: { total: quantity(fields.total), pool: quantity(fields.inventory) },
          rewardAllowance: quantity(fields.allowance),
          poolHoldingCap: quantity(fields.cap),
          priceIndex: quantity(fields.price),
          poolFee: quantity(fields.fee, 4),
          exchangePool: { chainId: 100, id: pool.id, address: pool.deployment.address },
          replyBusinessDays: whole(fields.reply),
          acceptanceDays: whole(fields.acceptance),
          document: { reference: fields.reference.trim(), digest: fields.digest.trim() },
        },
      });
      setReviewed(draft);
      setInvalid(false);
      setFailed(false);
    } catch {
      setInvalid(true);
    }
  };
  const save = async () => {
    if (!reviewed || pending) return;
    setFailed(false);
    try {
      await onSave(reviewed);
      onClose();
    } catch {
      setFailed(true);
    }
  };
  return (
    <AdminDialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
      title={t(reviewed ? "review" : record ? "edit" : "create")}
      target={pool.name}
      description={t("reviewHelp")}
      size="lg"
      height="stable"
      tone="community"
      preventClose={pending}
      actions={
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            emphasis="tertiary"
            disabled={pending}
            onClick={reviewed ? () => setReviewed(null) : onClose}
          >
            {t(reviewed ? "back" : "cancel")}
          </Button>
          {reviewed ? (
            <Button type="button" disabled={pending} onClick={() => void save()}>
              {t("save")}
            </Button>
          ) : (
            <Button type="submit" form={formId} disabled={pending}>
              {t("review")}
            </Button>
          )}
        </div>
      }
    >
      {invalid || failed ? (
        <Alert variant="error">{t(failed ? "failed" : "required")}</Alert>
      ) : null}
      {record?.approval ? <p className="type-meta text-text-soft">{t("signedRevision")}</p> : null}
      {reviewed ? (
        <FactList>
          <FactRow
            label={t("pool")}
            value={
              <span>
                {pool.name}
                <br />
                <span className="break-all">{pool.deployment.address}</span>
              </span>
            }
          />
          {FIELDS.map((key) => (
            <FactRow
              key={key}
              label={t(key)}
              value={<span className="break-words">{fields[key]}</span>}
            />
          ))}
        </FactList>
      ) : (
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            review();
          }}
          className="grid gap-x-4 gap-y-1 sm:grid-cols-2"
        >
          {FIELDS.map((key) =>
            MULTILINE.has(key) ? (
              <AdminTextArea
                key={key}
                label={t(key)}
                value={fields[key]}
                required
                disabled={pending}
                className="sm:col-span-2"
                textareaProps={{ maxLength: 2000 }}
                onChange={(event) => setFields({ ...fields, [key]: event.target.value })}
              />
            ) : (
              <AdminTextField
                key={key}
                label={t(key)}
                value={fields[key]}
                required
                disabled={pending || (key === "member" && Boolean(record))}
                inputProps={{ maxLength: key === "reference" ? 500 : 240 }}
                onChange={(event) => setFields({ ...fields, [key]: event.target.value })}
              />
            )
          )}
        </form>
      )}
    </AdminDialog>
  );
}
