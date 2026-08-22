import { DialogShell } from "@green-goods/shared";
import { RiGroupLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";

export type ClaimContext = "personal" | "garden";

export interface ClaimContextSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gardenName: string | null;
  /** Only a steward of this garden may take something up for it. */
  canClaimForGarden: boolean;
  /** Steward-reviewed claims ask; open ones take up. The sheet names which. */
  approvalGated: boolean;
  isPending: boolean;
  onContinue: (context: ClaimContext) => void;
}

/**
 * The provider-context choice before a protocol-pool claim.
 *
 * A commitment in the protocol pool can be taken up by a person or, by an
 * eligible steward, for their garden. Personal is the default and the only
 * option for everyone else. The choice is resolved here, before any claim
 * exists, and is never rewritten afterwards: a garden claim stores the garden
 * as claimant and the steward as the one who asked.
 */
export function ClaimContextSheet({
  open,
  onOpenChange,
  gardenName,
  canClaimForGarden,
  approvalGated,
  isPending,
  onContinue,
}: ClaimContextSheetProps) {
  const { formatMessage } = useIntl();
  const [context, setContext] = useState<ClaimContext>("personal");

  // Each opening starts from Personal; back and retry keep whatever was
  // chosen until the sheet closes, and nothing is submitted in between.
  useEffect(() => {
    if (open) setContext("personal");
  }, [open]);

  const garden = gardenName ?? formatMessage({ id: "app.claim.context.thisGarden" });

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      preventClose={isPending}
      title={formatMessage({ id: "app.claim.context.title" })}
      description={formatMessage({ id: "app.claim.context.body" })}
      size="md"
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="sr-only">{formatMessage({ id: "app.claim.context.legend" })}</legend>
          <div className="space-y-2">
            <Option
              id="claim-context-personal"
              checked={context === "personal"}
              onChange={() => setContext("personal")}
              title={formatMessage({ id: "app.claim.context.personal.title" })}
              body={formatMessage({ id: "app.claim.context.personal.body" })}
            />
            {canClaimForGarden ? (
              <Option
                id="claim-context-garden"
                checked={context === "garden"}
                onChange={() => setContext("garden")}
                title={formatMessage({ id: "app.claim.context.garden.title" }, { garden })}
                body={formatMessage({ id: "app.claim.context.garden.body" })}
              />
            ) : null}
          </div>
        </fieldset>

        {context === "garden" ? (
          <p className="flex items-start gap-2 rounded-[var(--radius-lg)] bg-bg-weak-50 p-3 text-xs text-text-sub-600">
            <RiGroupLine className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {formatMessage({ id: "app.claim.context.gardenNote" })}
          </p>
        ) : null}

        <button
          type="button"
          disabled={isPending}
          aria-busy={isPending}
          onClick={() => onContinue(context)}
          className="w-full rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg disabled:opacity-60"
        >
          {formatMessage({
            id: approvalGated ? "app.commitment.act.askToTakeUp" : "app.commitment.act.takeUp",
          })}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onOpenChange(false)}
          className="w-full rounded-[var(--radius-lg)] px-4 py-3 text-sm font-medium text-text-sub-600 tap-target-lg"
        >
          {formatMessage({ id: "app.claim.context.cancel" })}
        </button>
      </div>
    </DialogShell>
  );
}

function Option({
  id,
  checked,
  onChange,
  title,
  body,
}: {
  id: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  body: string;
}) {
  return (
    <div
      className={
        checked
          ? "flex items-start gap-3 rounded-[var(--radius-lg)] border border-primary-alpha-24 bg-primary-alpha-10 p-3"
          : "flex items-start gap-3 rounded-[var(--radius-lg)] border border-stroke-soft-200 p-3"
      }
    >
      <input
        id={id}
        type="radio"
        name="claim-context"
        checked={checked}
        onChange={onChange}
        className="mt-1 accent-[var(--color-primary)]"
      />
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-text-strong-950">{title}</span>
        <span className="block text-xs text-text-sub-600">{body}</span>
      </label>
    </div>
  );
}
