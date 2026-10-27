import type { ServiceIssuerDraft } from "@green-goods/shared/commitment-pooling";
import { Alert } from "@green-goods/shared/components/Alert";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { useId, useState } from "react";
import { useIntl } from "react-intl";
import { ServiceStepStrip } from "../Home/Garden/Commitment/ServiceStepStrip";
import { type DraftFact, factValue } from "./serviceIssuerDraftFacts";

/** The settings a member most needs in view while approving; the section lists all of them. */
const IN_SHEET = new Set(["unit", "capacity", "issue", "allowance", "rate", "pool"]);

interface Props {
  draft: ServiceIssuerDraft;
  facts: DraftFact[];
  approving: boolean;
  onClose: () => void;
  onApprove: () => Promise<void>;
}

/**
 * Approve Your Service: the exact terms, what stays the member's, and what approving records.
 * Approving signs these terms from this account; it sends nothing and issues nothing.
 */
export function ServiceIssuerApproveSheet({ draft, facts, approving, onClose, onApprove }: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id: `app.voucher.ob.${id}` });
  const [agreed, setAgreed] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = useId();
  return (
    <DialogShell
      open
      onOpenChange={(open) => {
        if (!open && !approving) onClose();
      }}
      preventClose={approving}
      title={t("sh.title")}
      description={draft.terms.service.title}
      size="md"
      sheetSize="full"
      actions={{
        primary: {
          label: t("sh.cta"),
          disabled: !agreed,
          loading: approving,
          onClick: async () => {
            if (!agreed || approving) return;
            setFailed(false);
            try {
              await onApprove();
            } catch {
              setFailed(true);
            }
          },
        },
        secondary: {
          label: intl.formatMessage({ id: "app.voucher.c.cancel" }),
          disabled: approving,
          onClick: onClose,
        },
      }}
    >
      <div className="space-y-4" data-component="ServiceIssuerApproveSheet">
        <ServiceStepStrip
          label={t("sh.journey")}
          steps={[
            { id: "approve", label: t("j.approve"), state: "now" },
            { id: "setup", label: t("j.setup"), state: "wait" },
            { id: "register", label: t("j.register"), state: "wait" },
            { id: "admit", label: t("j.admit"), state: "wait" },
            { id: "enable", label: t("j.enable"), state: "todo" },
          ]}
        />
        <FactList>
          {facts
            .filter((fact) => IN_SHEET.has(fact.id))
            .map((fact) => (
              <FactRow key={fact.id} label={fact.label} value={factValue(fact)} />
            ))}
          <FactRow
            label={t("sh.yours")}
            value={factValue({ value: t("sh.yoursV"), detail: t("sh.yoursS") })}
          />
          <FactRow
            label={t("sh.record")}
            value={factValue({ value: t("sh.recordV"), detail: t("sh.recordS") })}
          />
        </FactList>
        <label htmlFor={id} className="flex min-h-11 items-start gap-3 text-sm">
          <input
            id={id}
            type="checkbox"
            checked={agreed}
            disabled={approving}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-1 accent-[var(--color-primary-on-surface)]"
          />
          <span>{t("sh.chk")}</span>
        </label>
        <p className="text-sm text-text-sub-600">{t("sh.consent")}</p>
        {failed ? <Alert variant="error">{t("sh.failed")}</Alert> : null}
        <p className="text-xs text-text-sub-600">{t("sh.foot")}</p>
      </div>
    </DialogShell>
  );
}
