import type { CommitmentComposerValues } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import { useAddressInput } from "@green-goods/shared/hooks/utils/useAddressInput";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { RiAddLine } from "@remixicon/react";
import { useId, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCardTitle } from "@/components/AdminCard";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminInputChip } from "@/components/AdminInputChip";
import { AdminTextField } from "@/components/AdminTextField";
import { getRoleLabel } from "@/components/Garden/gardenUtils";
import { PersonName } from "@/components/PersonName";
import { CONFIRMER_ADDRESS_PATTERN, type SeedFieldError, withConfirmer } from "./seedStepModel";

/** Someone in the garden, offered as a confirmer in one tap. */
export interface SeedMember {
  address: Address;
  role: GardenRole;
}

/** How many of the garden's people show before "All n members". */
const SUGGESTED = 3;

export interface SeedConfirmerListProps {
  form: UseFormReturn<CommitmentComposerValues>;
  values: CommitmentComposerValues;
  busy: boolean;
  errorOf: SeedFieldError;
  /** The garden's people, each once, in the order they should be offered. */
  members: readonly SeedMember[];
}

/** Two letters for a person's chip, or none for a bare address. */
function initialsOf(name: string): string | undefined {
  if (name.startsWith("0x")) return undefined;
  const words = name.split(/[\s.]+/).filter(Boolean);
  return (words.length > 1 ? `${words[0]![0]}${words[1]![0]}` : name.slice(0, 1)).toUpperCase();
}

/**
 * The named confirmer group and its threshold (PRD-1022 D8, D15). Chosen
 * people show as removable chips that wrap only after many. People come from
 * the garden in one tap, or from one field that takes a name or an address.
 * Nobody named leaves the ordinary rule in place, which reads differently for
 * an offer than for a request.
 */
export function SeedConfirmerList({
  form,
  values,
  busy,
  errorOf,
  members,
}: SeedConfirmerListProps) {
  const { formatMessage } = useIntl();
  const titleId = useId();
  const [showAll, setShowAll] = useState(false);
  const chosen = values.confirmers;
  const setConfirmers = (next: string[]) =>
    form.setValue("confirmers", next, { shouldDirty: true, shouldValidate: true });

  const add = (address: string) => {
    const next = withConfirmer(form.getValues("confirmers"), address);
    if (next) {
      setConfirmers(next);
      return { success: true };
    }
    return {
      success: false,
      error: CONFIRMER_ADDRESS_PATTERN.test(address.trim())
        ? formatMessage({
            id: "cockpit.garden.pool.seed.confirmerAlready",
            defaultMessage: "Already named.",
          })
        : formatMessage({
            id: "cockpit.garden.pool.seed.error.confirmerAddress",
            defaultMessage: "Enter a confirmer's own name or address.",
          }),
    };
  };
  const entry = useAddressInput(add, formatMessage);

  const isChosen = (address: string) =>
    chosen.some((named) => named.toLowerCase() === address.toLowerCase());
  const offered = members.filter((member) => !isChosen(member.address));
  const shown = showAll ? offered : offered.slice(0, SUGGESTED);

  return (
    <fieldset
      className="min-w-0 space-y-2"
      data-testid="seed-confirmers"
      disabled={busy}
      aria-labelledby={titleId}
    >
      <AdminCardTitle as="h4" id={titleId}>
        {formatMessage({
          id: "cockpit.garden.pool.seed.confirmers",
          defaultMessage: "Confirmers",
        })}
      </AdminCardTitle>
      <p className="body-xs text-text-soft">
        {chosen.length === 0
          ? values.direction === "REQUEST"
            ? formatMessage({
                id: "cockpit.garden.pool.seed.confirmersDefaultRequest",
                defaultMessage: "Nobody named: you confirm it yourself, as the one asking.",
              })
            : formatMessage({
                id: "cockpit.garden.pool.seed.confirmersDefaultOffer",
                defaultMessage: "Nobody named: whoever takes this up confirms it.",
              })
          : formatMessage({
              id: "cockpit.garden.pool.seed.confirmersNamed",
              defaultMessage:
                "A named group. The lead and every contributor are excluded by the contract.",
            })}
      </p>
      {chosen.length > 0 ? (
        <div
          role="list"
          aria-label={formatMessage({
            id: "cockpit.garden.pool.seed.confirmersChosen",
            defaultMessage: "Chosen confirmers",
          })}
          className="flex flex-wrap gap-2"
        >
          {chosen.map((address) => (
            <PersonName key={address} address={address as Address}>
              {(name) => (
                <AdminInputChip
                  label={name}
                  text={name === address ? address : `${name} · ${address}`}
                  avatar={initialsOf(name)}
                  disabled={busy}
                  removeLabel={formatMessage(
                    {
                      id: "cockpit.garden.pool.seed.confirmerRemove",
                      defaultMessage: "Remove {name}",
                    },
                    { name }
                  )}
                  onRemove={() => setConfirmers(chosen.filter((entry) => entry !== address))}
                />
              )}
            </PersonName>
          ))}
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <AdminTextField
          label={formatMessage({
            id: "cockpit.garden.pool.seed.confirmerAddLabel",
            defaultMessage: "Add a confirmer",
          })}
          value={entry.input}
          onChange={(event) => entry.setInput(event.target.value)}
          placeholder={formatMessage({
            id: "cockpit.garden.pool.seed.confirmerPlaceholder",
            defaultMessage: "A name.eth or an address",
          })}
          helperText={
            entry.resolvingEns
              ? formatMessage({
                  id: "cockpit.garden.pool.seed.confirmerResolving",
                  defaultMessage: "Looking up that name…",
                })
              : formatMessage({
                  id: "cockpit.garden.pool.seed.confirmerHint",
                  defaultMessage: "Names like lina.eth resolve to their account.",
                })
          }
          error={entry.error ?? errorOf("confirmers")}
          className="flex-1"
          inputProps={{
            onKeyDown: (event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void entry.handleAdd();
              }
            },
          }}
        />
        {/* Lifted over the field's reserved supporting line, so it lines up with the field. */}
        <AdminButton
          type="button"
          variant="outlined"
          size="sm"
          className="mb-5"
          leadingIcon={<RiAddLine className="h-4 w-4" />}
          onClick={() => void entry.handleAdd()}
          disabled={busy || entry.trimmedInput.length === 0}
        >
          {formatMessage({
            id: "cockpit.garden.pool.seed.confirmerAdd",
            defaultMessage: "Add",
          })}
        </AdminButton>
      </div>
      {offered.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="seed-confirmer-suggestions">
          <span className="label-xs text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.seed.fromThisGarden",
              defaultMessage: "From this garden",
            })}
          </span>
          {shown.map((member) => (
            <PersonName key={member.address} address={member.address}>
              {(name) => (
                <AdminFilterChip
                  label={`${name} · ${getRoleLabel(member.role, formatMessage).singular}`}
                  selected={false}
                  leadingIcon={RiAddLine}
                  disabled={busy}
                  onToggle={() => add(member.address)}
                />
              )}
            </PersonName>
          ))}
          {offered.length > SUGGESTED ? (
            <AdminButton
              type="button"
              variant="text"
              size="sm"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll
                ? formatMessage({
                    id: "cockpit.garden.pool.seed.fewerMembers",
                    defaultMessage: "Fewer",
                  })
                : formatMessage(
                    {
                      id: "cockpit.garden.pool.seed.allMembers",
                      defaultMessage: "All {count} members",
                    },
                    { count: offered.length }
                  )}
            </AdminButton>
          ) : null}
        </div>
      ) : null}
      {chosen.length > 0 ? (
        <AdminTextField
          label={formatMessage({
            id: "cockpit.garden.pool.seed.threshold",
            defaultMessage: "How many must confirm",
          })}
          value={String(values.confirmationThreshold)}
          onChange={(event) =>
            form.setValue("confirmationThreshold", Number(event.target.value), {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          error={errorOf("confirmationThreshold")}
          helperText={formatMessage(
            {
              id: "cockpit.garden.pool.seed.thresholdOfNamed",
              defaultMessage:
                "Of {count} named. The lead and every contributor are excluded by the contract.",
            },
            { count: chosen.length }
          )}
          inputProps={{ inputMode: "numeric" }}
          className="max-w-sm"
        />
      ) : null}
    </fieldset>
  );
}
