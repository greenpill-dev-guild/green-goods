import { Button } from "@green-goods/shared/components/Button";
import type { CommitmentComposerValues } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import { useAddressInput } from "@green-goods/shared/hooks/utils/useAddressInput";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { RiAddLine } from "@remixicon/react";
import { useId, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";
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

/** A named confirmer group being edited: Seed's form, or Edit Confirmers' own state. */
interface ConfirmerGroupDraft {
  confirmers: string[];
  threshold: number;
  /** Read the latest list, for a name that resolves after other changes. */
  read: () => string[];
  setConfirmers: (next: string[]) => void;
  setThreshold: (next: number) => void;
  errors: { confirmers?: string; threshold?: string };
}

export interface ConfirmerGroupEditorProps {
  draft: ConfirmerGroupDraft;
  /** What naming nobody means here: who confirms under the ordinary rule. */
  ordinaryNote: string;
  busy: boolean;
  /** The garden's people, each once, in the order they should be offered. */
  members: readonly SeedMember[];
  /** Told whether a typed name or address is waiting to be added, so a save can wait for it. */
  onPendingChange?: (pending: boolean) => void;
}

/**
 * The named confirmer group and its threshold (PRD-1022 D8, D15). Seed's
 * answers, through the composer form, and Edit Confirmers both use it.
 */
export function SeedConfirmerList({
  form,
  values,
  busy,
  errorOf,
  members,
}: SeedConfirmerListProps) {
  const { formatMessage } = useIntl();
  const options = { shouldDirty: true, shouldValidate: true };
  return (
    <ConfirmerGroupEditor
      draft={{
        confirmers: values.confirmers,
        threshold: values.confirmationThreshold,
        read: () => form.getValues("confirmers"),
        setConfirmers: (next) => form.setValue("confirmers", next, options),
        setThreshold: (next) => form.setValue("confirmationThreshold", next, options),
        errors: {
          confirmers: errorOf("confirmers"),
          threshold: errorOf("confirmationThreshold"),
        },
      }}
      ordinaryNote={
        values.direction === "REQUEST"
          ? formatMessage({
              id: "hub.garden.pool.seed.confirmersDefaultRequest",
              defaultMessage: "Nobody named: you confirm it yourself, as the one asking.",
            })
          : formatMessage({
              id: "hub.garden.pool.seed.confirmersDefaultOffer",
              defaultMessage: "Nobody named: whoever takes this up confirms it.",
            })
      }
      busy={busy}
      members={members}
    />
  );
}

/**
 * Chosen people show as removable chips that wrap only after many. People come
 * from the garden in one tap, or from one field that takes a name or an
 * address. Nobody named leaves the ordinary rule in place, which the caller
 * says in its own words (`ordinaryNote`).
 */
export function ConfirmerGroupEditor({
  draft,
  ordinaryNote,
  busy,
  members,
  onPendingChange,
}: ConfirmerGroupEditorProps) {
  const { formatMessage } = useIntl();
  const titleId = useId();
  const [showAll, setShowAll] = useState(false);
  const chosen = draft.confirmers;
  const setConfirmers = draft.setConfirmers;

  const add = (address: string) => {
    const next = withConfirmer(draft.read(), address);
    if (next) {
      setConfirmers(next);
      onPendingChange?.(false);
      return { success: true };
    }
    return {
      success: false,
      error: CONFIRMER_ADDRESS_PATTERN.test(address.trim())
        ? formatMessage({
            id: "hub.garden.pool.seed.confirmerAlready",
            defaultMessage: "Already named.",
          })
        : formatMessage({
            id: "hub.garden.pool.seed.error.confirmerAddress",
            defaultMessage: "Enter a confirmer's own name or address.",
          }),
    };
  };
  const entry = useAddressInput(add, formatMessage);
  // A typed name holds the field and Add until its lookup lands (PRD-1548): a second name started
  // meanwhile was cleared when the first landed, so a save in between left it out.
  const [lookingUp, setLookingUp] = useState(false);
  const addTyped = async () => {
    if (lookingUp) return;
    setLookingUp(true);
    try {
      await entry.handleAdd();
    } finally {
      setLookingUp(false);
    }
  };

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
          id: "hub.garden.pool.seed.confirmers",
          defaultMessage: "Confirmers",
        })}
      </AdminCardTitle>
      <p className="type-meta text-text-soft">
        {chosen.length === 0
          ? ordinaryNote
          : formatMessage({
              id: "hub.garden.pool.seed.confirmersNamed",
              defaultMessage:
                "A named group. The lead and every contributor are excluded by the contract.",
            })}
      </p>
      {chosen.length > 0 ? (
        <div
          role="list"
          aria-label={formatMessage({
            id: "hub.garden.pool.seed.confirmersChosen",
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
                      id: "hub.garden.pool.seed.confirmerRemove",
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
      <AdminTextField
        label={formatMessage({
          id: "hub.garden.pool.seed.confirmerAddLabel",
          defaultMessage: "Add a confirmer",
        })}
        value={entry.input}
        onChange={(event) => {
          if (lookingUp) return;
          entry.setInput(event.target.value);
          onPendingChange?.(event.target.value.trim().length > 0);
        }}
        placeholder={formatMessage({
          id: "hub.garden.pool.seed.confirmerPlaceholder",
          defaultMessage: "A name.eth or an address",
        })}
        helperText={
          lookingUp || entry.resolvingEns
            ? formatMessage({
                id: "hub.garden.pool.seed.confirmerResolving",
                defaultMessage: "Looking up that name…",
              })
            : formatMessage({
                id: "hub.garden.pool.seed.confirmerHint",
                defaultMessage: "Names like lina.eth resolve to their account.",
              })
        }
        error={entry.error ?? draft.errors.confirmers}
        inputProps={{
          readOnly: lookingUp,
          onKeyDown: (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void addTyped();
            }
          },
        }}
        action={
          <Button
            type="button"
            emphasis="secondary"
            size="compact"
            leadingIcon={<RiAddLine className="h-4 w-4" aria-hidden="true" />}
            onClick={() => void addTyped()}
            loading={lookingUp}
            disabled={busy || entry.trimmedInput.length === 0}
          >
            {formatMessage({
              id: "hub.garden.pool.seed.confirmerAdd",
              defaultMessage: "Add",
            })}
          </Button>
        }
      />
      {offered.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="seed-confirmer-suggestions">
          <span className="type-label-sm text-text-soft">
            {formatMessage({
              id: "hub.garden.pool.seed.fromThisGarden",
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
                  disabled={busy || lookingUp}
                  onToggle={() => add(member.address)}
                />
              )}
            </PersonName>
          ))}
          {offered.length > SUGGESTED ? (
            <Button
              type="button"
              emphasis="tertiary"
              size="compact"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll
                ? formatMessage({
                    id: "hub.garden.pool.seed.fewerMembers",
                    defaultMessage: "Fewer",
                  })
                : formatMessage(
                    {
                      id: "hub.garden.pool.seed.allMembers",
                      defaultMessage: "All {count} members",
                    },
                    { count: offered.length }
                  )}
            </Button>
          ) : null}
        </div>
      ) : null}
      {chosen.length > 0 ? (
        <AdminTextField
          label={formatMessage({
            id: "hub.garden.pool.seed.threshold",
            defaultMessage: "How many must confirm",
          })}
          value={String(draft.threshold)}
          onChange={(event) => draft.setThreshold(Number(event.target.value))}
          error={draft.errors.threshold}
          helperText={formatMessage(
            {
              id: "hub.garden.pool.seed.thresholdOfNamed",
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
