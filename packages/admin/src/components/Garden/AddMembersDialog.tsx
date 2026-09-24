import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import { useEnsAddress } from "@green-goods/shared/hooks/blockchain/useEnsAddress";
import { useGardenRoleHat } from "@green-goods/shared/hooks/roles/useGardenRoleHat";
import { logger } from "@green-goods/shared/modules/app/logger";
import type { Address } from "@green-goods/shared/types/domain";
import { resolveEnsAddress } from "@green-goods/shared/utils/blockchain/ens";
import {
  GARDEN_ROLE_ORDER,
  type GardenRole,
} from "@green-goods/shared/utils/blockchain/garden-roles";
import { parseAndFormatError } from "@green-goods/shared/utils/errors/contract-errors";
import { RiAddLine, RiClipboardLine } from "@remixicon/react";
import { type ReactNode, useId, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { isAddress } from "viem";
import { EnsAddressText } from "@/components/EnsAddressText";
import { AdminButton, AdminIconButton } from "../AdminButton";
import { AdminDialog, type AdminDialogProps } from "../AdminDialog";
import { AdminSelect, AdminTextField } from "../AdminTextField";
import { DiscardChangesDialog } from "../DiscardChangesDialog";
import {
  buildRolesByAddress,
  canStage,
  checkEntry,
  formatRoleNames,
  type StagedMember,
  sharedRole,
} from "./addMembersEntry";
import { getRoleLabel } from "./gardenUtils";
import { StagedMemberList } from "./StagedMemberList";

export interface AddMembersDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * Commit one address for one role. The dialog loops the staged batch itself;
   * a `{ success: false }` result (or a throw) keeps that address staged for
   * retry. Wire this to `useGardenOperations` in the hosting view.
   */
  onAdd: (role: GardenRole, address: Address) => Promise<{ success: boolean }>;
  /** The garden being written to; the chain confirms held roles against it. */
  gardenAddress: Address;
  /**
   * Who holds which role today (the indexed roster). The dialog uses it to
   * refuse a role someone already has, confirmed on chain first because the
   * roster can lag, and to show what adding a role changes for an existing member.
   */
  roleMembers: Record<GardenRole, Address[]>;
  /** Starts the field with this person (the Manage Roles path into promotion). */
  initialAddress?: Address;
  /** Disables inputs while the hosting view runs an unrelated write. */
  isLoading?: boolean;
  tone?: AdminDialogProps["tone"];
}

/**
 * Add Members — the single add path for garden membership (multi-add with a
 * staged list). Role select + address/ENS input; each resolved person stages
 * into a fixed-height list with the role picked for them (changing the picker
 * only affects the next person), then the whole batch commits on submit.
 * Someone who already holds the picked role cannot be staged, so the dialog
 * never asks the wallet to sign for nothing. Failed writes stay staged for retry.
 */
export function AddMembersDialog({
  open,
  onClose,
  onAdd,
  gardenAddress,
  roleMembers,
  initialAddress,
  isLoading = false,
  tone,
}: AddMembersDialogProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const statusId = useId();
  const [selectedRole, setSelectedRole] = useState<GardenRole>("gardener");
  const [input, setInput] = useState(initialAddress ?? "");
  const [pending, setPending] = useState<StagedMember[]>([]);
  const [error, setError] = useState("");
  const [submitResolving, setSubmitResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shownFor, setShownFor] = useState({ open, initialAddress });

  // Each opening, and each change of the person it opens for, starts the field
  // from `initialAddress`. Resetting here, rather than remounting through a
  // key, keeps the closing dialog mounted so its exit motion plays.
  if (open !== shownFor.open || initialAddress !== shownFor.initialAddress) {
    setShownFor({ open, initialAddress });
    if (open) {
      setInput(initialAddress ?? "");
      setError("");
    }
  }

  const trimmed = input.trim();
  const isHexAddress = useMemo(() => (trimmed ? isAddress(trimmed) : false), [trimmed]);
  const shouldResolveEns = trimmed.length > 2 && !isHexAddress;
  const { data: resolvedEnsAddress, isFetching: resolvingEns } = useEnsAddress(
    shouldResolveEns ? trimmed : null,
    { enabled: shouldResolveEns }
  );
  const busy = submitResolving || submitting || isLoading;
  const rolesByAddress = useMemo(() => buildRolesByAddress(roleMembers), [roleMembers]);
  const typedResolvedAddress = useMemo<Address | null>(() => {
    if (!trimmed) return null;
    if (isHexAddress) return trimmed as Address;
    return resolvedEnsAddress && isAddress(resolvedEnsAddress)
      ? (resolvedEnsAddress as Address)
      : null;
  }, [isHexAddress, resolvedEnsAddress, trimmed]);
  // The indexed roster can lag a revoke, so a "held" it proposes is confirmed
  // on chain. Until the chain answers, or if the read fails, the roster stands.
  const typedRosterCheck = typedResolvedAddress
    ? checkEntry(typedResolvedAddress, selectedRole, pending, rolesByAddress)
    : null;
  const { wearsHat: typedHeldOnChain } = useGardenRoleHat(
    gardenAddress,
    typedResolvedAddress,
    selectedRole,
    { enabled: typedRosterCheck?.kind === "held" }
  );
  const typedCheck = typedResolvedAddress
    ? checkEntry(typedResolvedAddress, selectedRole, pending, rolesByAddress, typedHeldOnChain)
    : null;
  const typedEntryCommitReady = typedCheck !== null && canStage(typedCheck);
  const typedInputInvalid = Boolean(trimmed) && !resolvingEns && !typedResolvedAddress;

  const roleName = (role: GardenRole) => getRoleLabel(role, formatMessage).singular;

  const resetDraft = () => {
    setInput("");
    setPending([]);
    setError("");
  };

  const resolveInput = async (): Promise<Address | null> => {
    if (!trimmed) return null;
    if (isAddress(trimmed)) return trimmed;
    try {
      const lookup = resolvedEnsAddress ?? (await resolveEnsAddress(trimmed));
      return lookup && isAddress(lookup) ? lookup : null;
    } catch (err) {
      logger.error("Failed to resolve ENS address for add-members dialog", {
        error: err,
        name: trimmed,
      });
      return null;
    }
  };

  const stageable = (address: Address) => {
    const isTyped = address.toLowerCase() === typedResolvedAddress?.toLowerCase();
    return canStage(
      checkEntry(
        address,
        selectedRole,
        pending,
        rolesByAddress,
        isTyped ? typedHeldOnChain : undefined
      )
    );
  };

  const handleAddToList = async () => {
    setError("");
    const resolved = await resolveInput();
    if (!resolved) {
      setError(formatMessage({ id: "app.admin.roles.error.ensResolutionFailed" }));
      return;
    }
    // The status line under the field already says why a person can't be added.
    if (!stageable(resolved)) return;
    setPending((prev) => [...prev, { address: resolved, role: selectedRole }]);
    setInput("");
  };

  const removeEntry = (address: Address) =>
    setPending((prev) => prev.filter((entry) => entry.address !== address));

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInput(text.trim());
        setError("");
      }
    } catch (err) {
      logger.error("Failed to read clipboard", { error: err });
      setError(formatMessage({ id: "app.admin.roles.error.clipboardFailed" }));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const failed: StagedMember[] = [];
    let processedCount = 0;
    let batch = pending;
    try {
      // Fold a typed-but-not-yet-staged person into the batch so a single
      // entry doesn't require the extra "Add" tap. Someone already queued, or
      // already holding the role, is left out; the status line says why. ENS
      // submit resolution is marked busy before awaiting so close paths cannot
      // continue into a wallet write after the steward cancels.
      if (trimmed) {
        if (!isHexAddress) setSubmitResolving(true);
        const resolved = await resolveInput();
        if (!resolved) {
          setError(formatMessage({ id: "app.admin.roles.error.ensResolutionFailed" }));
          return;
        }
        if (stageable(resolved)) batch = [...pending, { address: resolved, role: selectedRole }];
      }

      if (batch.length === 0) {
        setError(formatMessage({ id: "app.admin.roles.error.addressRequired" }));
        return;
      }

      setSubmitResolving(false);
      setSubmitting(true);
      for (const [index, entry] of batch.entries()) {
        const result = await onAdd(entry.role, entry.address);
        processedCount = index + 1;
        if (!result.success) failed.push(entry);
      }
      if (failed.length > 0) {
        // Keep only the failures staged for retry.
        setPending(failed);
        setInput("");
        setError(formatMessage({ id: "app.admin.roles.error.addFailed" }));
        return;
      }
      resetDraft();
      onClose();
    } catch (err) {
      const { message, parsed } = parseAndFormatError(err);
      setPending([...failed, ...batch.slice(processedCount)]);
      setInput("");
      setError(parsed.isKnown ? message : formatMessage({ id: "app.admin.roles.error.addFailed" }));
    } finally {
      setSubmitResolving(false);
      setSubmitting(false);
    }
  };

  // What the typed entry means, most specific first. A typed ENS name is
  // repeated as typed; a pasted address shows its ENS name when it has one.
  const typedMember: ReactNode =
    isHexAddress && typedResolvedAddress ? (
      <EnsAddressText address={typedResolvedAddress} />
    ) : (
      trimmed
    );
  let entryStatus: ReactNode = null;
  if (resolvingEns) {
    entryStatus = formatMessage({
      id: "admin.addMember.resolvingEns",
      defaultMessage: "Resolving ENS name...",
    });
  } else if (typedCheck?.kind === "staged") {
    entryStatus = (
      <FormattedMessage
        id="admin.addMember.alreadyStaged"
        values={{
          member: typedMember,
          role: roleName(typedCheck.stagedRole),
          roleKey: typedCheck.stagedRole,
        }}
      />
    );
  } else if (typedCheck?.kind === "held") {
    entryStatus = (
      <FormattedMessage
        id="admin.addMember.alreadyHasRole"
        values={{ member: typedMember, role: roleName(selectedRole), roleKey: selectedRole }}
      />
    );
  } else if (typedCheck?.kind === "member") {
    entryStatus = (
      <FormattedMessage
        id="admin.addMember.currentRolesHint"
        values={{
          member: typedMember,
          roles: formatRoleNames(typedCheck.currentRoles, intl),
          firstRoleKey: typedCheck.currentRoles[0],
        }}
      />
    );
  } else if (shouldResolveEns) {
    entryStatus = resolvedEnsAddress ? (
      <FormattedMessage
        id="admin.addMember.ensResolved"
        defaultMessage="Resolves to {address}"
        values={{ address: <EnsAddressText address={resolvedEnsAddress} /> }}
      />
    ) : (
      formatMessage({
        id: "admin.addMember.enterValidAddress",
        defaultMessage: "Enter a valid ENS name or 0x address.",
      })
    );
  }

  const formId = "admin-add-members-dialog";
  const batchRoles = [
    ...pending.map((entry) => entry.role),
    ...(typedEntryCommitReady ? [selectedRole] : []),
  ];
  const batchCount = batchRoles.length;
  // The button names the role when every row shares it; an empty list names
  // the role the picker would add.
  const batchRole = batchCount === 0 ? selectedRole : sharedRole(batchRoles);
  const submitLabel = batchRole
    ? formatMessage(
        { id: "admin.addMember.addCountRole" },
        { count: batchCount, ...getRoleLabel(batchRole, formatMessage) }
      )
    : formatMessage(
        {
          id: "admin.addMember.addCount",
          defaultMessage: "{count, plural, one {Add # Member} other {Add # Members}}",
        },
        { count: batchCount }
      );
  const closeAndReset = () => {
    resetDraft();
    onClose();
  };
  // Confirm-before-discard: a staged batch (or typed input) is unsaved
  // steward input, so X/scrim/Escape confirm first. A prefilled person nobody
  // changed is not. The footer Cancel still exits directly per the dialog contract.
  const dirtyClose = useDirtyClose({
    isDirty: pending.length > 0 || (Boolean(trimmed) && trimmed !== (initialAddress ?? "")),
    onClose: closeAndReset,
  });
  const handleOpenChange = (next: boolean) => {
    if (next || busy) return;
    dirtyClose.onOpenChange(false);
  };

  return (
    <>
      <AdminDialog
        open={open}
        onOpenChange={handleOpenChange}
        size="md"
        tone={tone}
        preventClose={busy}
        title={formatMessage({ id: "admin.addMember.title", defaultMessage: "Add Members" })}
        description={formatMessage({
          id: "admin.addMember.description",
          defaultMessage: "Choose a role for each person, then add the whole list.",
        })}
        actions={
          <>
            <AdminButton type="button" variant="text" onClick={closeAndReset} disabled={busy}>
              {formatMessage({ id: "admin.common.cancel", defaultMessage: "Cancel" })}
            </AdminButton>
            <AdminButton
              type="submit"
              form={formId}
              loading={submitResolving || submitting}
              disabled={busy || batchCount === 0 || typedInputInvalid || resolvingEns}
            >
              {submitLabel}
            </AdminButton>
          </>
        }
      >
        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
          <AdminSelect
            id="member-role"
            label={formatMessage({ id: "app.admin.roles.roleLabel", defaultMessage: "Role" })}
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as GardenRole)}
            disabled={busy}
          >
            {GARDEN_ROLE_ORDER.map((role) => (
              <option key={role} value={role}>
                {formatMessage({ id: `app.roles.${role}` })}
              </option>
            ))}
          </AdminSelect>
          <div>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start">
              <AdminTextField
                id="member-address"
                className="min-w-0 flex-1"
                label={formatMessage({ id: "app.admin.roles.addressLabel" })}
                error={error || undefined}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setError("");
                }}
                placeholder={formatMessage({
                  id: "admin.addMember.placeholder",
                  defaultMessage: "0x... or name.eth",
                })}
                disabled={busy}
                inputProps={{
                  "aria-invalid": !!error || typedInputInvalid,
                  "aria-describedby": statusId,
                }}
              />
              <div className="flex items-center gap-2 pt-1.5">
                <AdminIconButton
                  onClick={handlePaste}
                  disabled={busy}
                  label={formatMessage({
                    id: "admin.addMember.paste",
                    defaultMessage: "Paste from Clipboard",
                  })}
                >
                  <RiClipboardLine />
                </AdminIconButton>
                <AdminButton
                  type="button"
                  variant="tonal"
                  onClick={() => handleAddToList()}
                  disabled={busy || !typedEntryCommitReady || resolvingEns}
                  leadingIcon={<RiAddLine />}
                >
                  {formatMessage({ id: "admin.addMember.addToList", defaultMessage: "Add" })}
                </AdminButton>
              </div>
            </div>
            {/* Always mounted so screen readers hear each change; guidance is
                calm supporting text, never an error state, inset like the
                field's own supporting text. */}
            <p
              id={statusId}
              aria-live="polite"
              className="mt-1 px-4 body-sm text-text-soft empty:mt-0"
            >
              {entryStatus}
            </p>
          </div>

          <StagedMemberList
            members={pending}
            rolesByAddress={rolesByAddress}
            onRemove={removeEntry}
            disabled={busy}
          />
        </form>
      </AdminDialog>
      <DiscardChangesDialog
        open={dirtyClose.confirmOpen}
        onKeepEditing={dirtyClose.cancelClose}
        onDiscard={dirtyClose.confirmClose}
        tone={tone}
      />
    </>
  );
}
