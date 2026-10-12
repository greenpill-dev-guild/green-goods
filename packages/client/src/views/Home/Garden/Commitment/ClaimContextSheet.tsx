import type { Address } from "@green-goods/shared/types/domain";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { RiGroupLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";

/**
 * What a claim is scoped to: the person, through a garden they belong to, or
 * a garden they steward. The garden travels with the choice because on the
 * protocol pool it need not be the route's garden. The host may carry a
 * personal claim from someone who holds a role there, but the contract refuses
 * it as a garden claim's context (GardenClaimMustBeExternal).
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
  /** The primary act's words when another step follows the choice; the take-up act by default. */
  continueLabel?: string;
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
const same = (left: Address, right: Address) => left.toLowerCase() === right.toLowerCase();

export function ClaimContextSheet({
  open,
  onOpenChange,
  memberGardens,
  stewardedGardens,
  approvalGated,
  isPending,
  continueLabel,
  onContinue,
}: ClaimContextSheetProps) {
  const { formatMessage } = useIntl();
  const first = memberGardens[0] ?? stewardedGardens[0];
  const [context, setContext] = useState<ClaimContext | null>(null);

  // Each opening starts from the first personal option. While the sheet is
  // open a choice stands, even as the lists refresh behind it (the host's own
  // read landing adds an option), unless its garden has left them. Nothing is
  // submitted between.
  useEffect(() => {
    if (!open) {
      setContext(null);
      return;
    }
    setContext((current) => {
      const offered =
        current &&
        (current.kind === "personal" ? memberGardens : stewardedGardens).some((garden) =>
          same(garden.address, current.garden)
        );
      if (current && offered) return current;
      return memberGardens[0]
        ? { kind: "personal", garden: memberGardens[0].address }
        : first
          ? { kind: "garden", garden: first.address }
          : null;
    });
  }, [open, memberGardens, stewardedGardens, first]);

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      preventClose={isPending}
      title={formatMessage({ id: "app.claim.context.title" })}
      description={formatMessage({ id: "app.claim.context.body" })}
      size="md"
      sheetSize="half"
      actions={{
        primary: {
          label:
            continueLabel ??
            formatMessage({
              id: approvalGated ? "app.commitment.act.askToTakeUp" : "app.commitment.act.takeUp",
            }),
          disabled: !context,
          loading: isPending,
          onClick: () => context && onContinue(context),
        },
        secondary: {
          label: formatMessage({ id: "app.claim.context.cancel" }),
          disabled: isPending,
          onClick: () => onOpenChange(false),
        },
      }}
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
        className="mt-1 accent-[var(--color-primary-on-surface)]"
      />
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-text-strong-950">{title}</span>
        <span className="block text-xs text-text-sub-600">{body}</span>
      </label>
    </div>
  );
}
