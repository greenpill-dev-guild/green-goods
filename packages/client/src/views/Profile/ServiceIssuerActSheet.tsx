import type {
  ServiceIssuerAction,
  ServiceIssuerBooking,
  ServiceIssuerSnapshot,
} from "@green-goods/shared/commitment-pooling";
import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { Alert } from "@green-goods/shared/components/Alert";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { FormField } from "@green-goods/shared/components/Form/FormFieldWrapper";
import { type ReactNode, useId, useState } from "react";
import { useIntl } from "react-intl";
import { issuerAmount, issuerCount, parseIssuerAmount } from "./serviceIssuerPresentation";

type Onchain = Extract<ServiceIssuerSnapshot, { evidence: "onchain" }>;

/** The member's acts that need a quantity first; the exact review follows as its own step. */
export type IssuerEntry =
  | { kind: "issue" }
  | { kind: "allowance" }
  | { kind: "return"; booking: ServiceIssuerBooking };

interface Props {
  entry: IssuerEntry;
  snapshot: Onchain;
  busy: boolean;
  failed: boolean;
  onClose: () => void;
  onReview: (action: ServiceIssuerAction) => void;
}

/**
 * The quantity for Issue More, Propose Return or Approve for Rewards, held to the member's
 * reviewed limits. Review prepares the exact transaction; nothing is signed here.
 */
export function ServiceIssuerActSheet({ entry, snapshot, busy, failed, onClose, onReview }: Props) {
  const { formatMessage, locale } = useIntl();
  const t = (id: string, values?: Record<string, string>) =>
    formatMessage({ id: `app.voucher.ms.${id}` }, values);
  const [value, setValue] = useState("");
  const id = useId();
  const { asset } = snapshot;
  const amount = parseIssuerAmount(value, asset.decimals);
  const count = (units: bigint) => issuerCount(units, asset.decimals, locale);
  const units = (units: bigint) => issuerAmount(units, asset, locale);
  let title: string;
  let facts: { label: string; value: ReactNode }[];
  let field: { label: string; hint: string };
  let note: string;
  let reason: { title: string; body: string } | null = null;
  let action: ServiceIssuerAction | null = null;
  if (entry.kind === "issue") {
    const promised = asset.initialSupply ?? 0n;
    const room = promised > snapshot.totalMinted ? promised - snapshot.totalMinted : 0n;
    title = t("sh.issue.t");
    facts = [
      {
        label: t("cap.t"),
        value: t("sh.issueRoom", {
          promised: count(promised),
          issued: count(snapshot.totalMinted),
          room: count(room),
        }),
      },
    ];
    field = { label: t("fl.issue"), hint: t("fl.issueHint", { max: units(room) }) };
    note = t("sh.issueNote");
    if (room === 0n)
      reason = {
        title: t("r.capFull.t"),
        body: t("r.capFull.b", { promised: count(promised), issued: count(snapshot.totalMinted) }),
      };
    else if (amount !== null && amount <= room) action = { kind: "issue", amount };
  } else if (entry.kind === "allowance") {
    const limit = asset.adapterAllowance ?? 0n;
    const reserve = snapshot.issuerReserveBalance ?? 0n;
    const max = limit < reserve ? limit : reserve;
    title = t("sh.allow.t");
    facts = [
      {
        label: t("v.allow"),
        value: t("v.allowV", { left: count(snapshot.reserveAllowance ?? 0n), of: count(limit) }),
      },
    ];
    field = { label: t("fl.issue"), hint: t("fl.allowHint", { max: units(max) }) };
    note = t("sh.allowNote");
    if (amount !== null && amount <= max) action = { kind: "approveReserve", amount };
  } else {
    const b = entry.booking;
    const booked = b.authorization.voucherUnits;
    title = t("sh.propose.t");
    facts = [
      {
        label: t("sh.holder"),
        value: <AddressDisplay address={b.authorization.holder}>{(name) => name}</AddressDisplay>,
      },
      { label: t("sh.booked"), value: units(booked) },
      { label: t("sh.proposed"), value: units(b.issuerReturnCeiling) },
    ];
    field = {
      label: t("fl.back"),
      hint: t("fl.backHint", { current: units(b.issuerReturnCeiling), max: units(booked) }),
    };
    note = t("sh.proposeNote");
    if (amount !== null && amount > b.issuerReturnCeiling && amount <= booked)
      action = {
        kind: "authorizeReturn",
        setupId: b.setupId,
        authorizationHash: b.authorizationHash,
        ceiling: amount,
      };
  }
  const invalid = value !== "" && action === null && reason === null;
  return (
    <DialogShell
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      preventClose={busy}
      title={title}
      size="md"
      sheetSize="tall"
      actions={{
        primary: {
          label: t("a.review"),
          disabled: action === null,
          loading: busy,
          onClick: () => {
            if (action && !busy) onReview(action);
          },
        },
        secondary: {
          label: formatMessage({ id: "app.voucher.c.cancel" }),
          disabled: busy,
          onClick: onClose,
        },
      }}
    >
      <div className="space-y-4" data-component="ServiceIssuerActSheet" data-kind={entry.kind}>
        <FactList>
          {facts.map((fact) => (
            <FactRow key={fact.label} label={fact.label} value={fact.value} />
          ))}
        </FactList>
        {reason ? (
          <Alert variant="warning" title={reason.title}>
            {reason.body}
          </Alert>
        ) : (
          <FormField
            label={`${field.label} (${asset.symbol})`}
            htmlFor={id}
            hint={field.hint}
            error={invalid ? t("fl.invalid") : undefined}
          >
            <TextInput
              id={id}
              value={value}
              inputMode="decimal"
              required
              disabled={busy}
              aria-describedby={`${id}-helper-text`}
              aria-invalid={invalid || undefined}
              onChange={(event) => setValue(event.target.value)}
            />
          </FormField>
        )}
        <p className="text-sm text-text-sub-600">{note}</p>
        {failed ? (
          <Alert variant="error">{formatMessage({ id: "app.profile.issuer.actionFailed" })}</Alert>
        ) : null}
      </div>
    </DialogShell>
  );
}
