import type { Address } from "@green-goods/shared/types/domain";
import { DialogShell } from "@green-goods/shared/components/Dialog/ConfirmDialog";
import { RiGroupLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";

/**
 * What a claim is scoped to: the person, through a garden they belong to, or
 * a garden they steward. The garden travels with the choice because on the
 * protocol pool it is never the route's garden — that is the host, which the
 * contract refuses as a garden-claim context (GardenClaimMustBeExternal) and
 * which most claimants hold no hat in.
 */
export type ClaimContext =
  | { kind: "personal"; garden: Address }
  | { kind: "garden"; garden: Address };

export interface ClaimGardenOption {
  address: Address;
  name: string;
}

export interface ClaimContextSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Gardens the claimant belongs to, for a personal claim. */
  memberGardens: ClaimGardenOption[];
  /** Gardens the claimant stewards, for a garden claim. Host excluded by the caller. */
  stewardedGardens: ClaimGardenOption[];
  /** Steward-reviewed claims ask; open ones take up. The sheet names which. */
  approvalGated: boolean;
  isPending: boolean;
  onContinue: (context: ClaimContext) => void;
}

/**
 * The provider-context choice before a protocol-pool claim.
 *
 * A commitment in the protocol pool can be taken up by a person, through one
 * of the gardens they belong to, or by a steward for a garden they run. The
 * choice is resolved here, before any claim exists, and is never rewritten
 * afterwards: a garden claim stores the garden as claimant and the steward as
 * the one who asked.
 */
export function ClaimContextSheet({
  open,
  onOpenChange,
  memberGardens,
  stewardedGardens,
  approvalGated,
  isPending,
  onContinue,
}: ClaimContextSheetProps) {
  const { formatMessage } = useIntl();
  const first = memberGardens[0] ?? stewardedGardens[0];
  const [context, setContext] = useState<ClaimContext | null>(null);

  // Each opening starts from the first personal option; back and retry keep
  // whatever was chosen until the sheet closes, and nothing is submitted between.
  useEffect(() => {
    if (!open) return;
    setContext(
      memberGardens[0]
        ? { kind: "personal", garden: memberGardens[0].address }
        : first
          ? { kind: "garden", garden: first.address }
          : null
    );
  }, [open, memberGardens, first]);

  const same = (left: Address, right: Address) => left.toLowerCase() === right.toLowerCase();

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
            {memberGardens.map((garden) => (
              <Option
                key={`personal-${garden.address}`}
                id={`claim-context-personal-${garden.address.toLowerCase()}`}
                checked={context?.kind === "personal" && same(context.garden, garden.address)}
                onChange={() => setContext({ kind: "personal", garden: garden.address })}
                title={formatMessage({ id: "app.claim.context.personal.title" })}
                body={formatMessage(
                  { id: "app.claim.context.personal.through" },
                  { garden: garden.name }
                )}
              />
            ))}
            {stewardedGardens.map((garden) => (
              <Option
                key={`garden-${garden.address}`}
                id={`claim-context-garden-${garden.address.toLowerCase()}`}
                checked={context?.kind === "garden" && same(context.garden, garden.address)}
                onChange={() => setContext({ kind: "garden", garden: garden.address })}
                title={formatMessage(
                  { id: "app.claim.context.garden.title" },
                  { garden: garden.name }
                )}
                body={formatMessage({ id: "app.claim.context.garden.body" })}
              />
            ))}
            {memberGardens.length === 0 && stewardedGardens.length === 0 ? (
              <p className="text-sm text-text-sub-600">
                {formatMessage({ id: "app.claim.context.noGarden" })}
              </p>
            ) : null}
          </div>
        </fieldset>

        {context?.kind === "garden" ? (
          <p className="flex items-start gap-2 rounded-[var(--radius-lg)] bg-bg-weak-50 p-3 text-xs text-text-sub-600">
            <RiGroupLine className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {formatMessage({ id: "app.claim.context.gardenNote" })}
          </p>
        ) : null}

        <button
          type="button"
          disabled={isPending || !context}
          aria-busy={isPending}
          onClick={() => context && onContinue(context)}
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
