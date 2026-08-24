import { NativeSelect, TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { FormField } from "@green-goods/shared/components/Form/FormFieldWrapper";
import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import { useEnsAddress } from "@green-goods/shared/hooks/blockchain/useEnsAddress";
import { logger } from "@green-goods/shared/modules/app/logger";
import type { Address } from "@green-goods/shared/types/domain";
import { resolveEnsAddress } from "@green-goods/shared/utils/blockchain/ens";
import {
  GARDEN_ROLE_ORDER,
  type GardenRole,
} from "@green-goods/shared/utils/blockchain/garden-roles";
import { parseAndFormatError } from "@green-goods/shared/utils/errors/contract-errors";
import { RiAddLine, RiClipboardLine, RiCloseLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { isAddress } from "viem";
import { EnsAddressText } from "@/components/EnsAddressText";
import { AdminButton } from "../AdminButton";
import { AdminDialog, type AdminDialogProps } from "../AdminDialog";
import { DiscardChangesDialog } from "../DiscardChangesDialog";

export interface AddMembersDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * Commit one address for one role. The dialog loops the staged batch itself;
   * a `{ success: false }` result (or a throw) keeps that address staged for
   * retry. Wire this to `useGardenOperations` in the hosting view.
   */
  onAdd: (role: GardenRole, address: Address) => Promise<{ success: boolean }>;
  /** Disables inputs while the hosting view runs an unrelated write. */
  isLoading?: boolean;
  tone?: AdminDialogProps["tone"];
}

/**
 * Add Members — the single add path for garden membership (multi-add with a
 * staged list). Role select + address/ENS input; each resolved entry stages
 * into a fixed-height list (the dialog never grows), then the whole batch
 * commits on submit. Failed writes stay staged for retry.
 */
export function AddMembersDialog({
  open,
  onClose,
  onAdd,
  isLoading = false,
  tone,
}: AddMembersDialogProps) {
  const { formatMessage } = useIntl();
  const [selectedRole, setSelectedRole] = useState<GardenRole>("gardener");
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Address[]>([]);
  const [error, setError] = useState("");
  const [submitResolving, setSubmitResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const trimmed = input.trim();
  const isHexAddress = useMemo(() => (trimmed ? isAddress(trimmed) : false), [trimmed]);
  const shouldResolveEns = trimmed.length > 2 && !isHexAddress;
  const { data: resolvedEnsAddress, isFetching: resolvingEns } = useEnsAddress(
    shouldResolveEns ? trimmed : null,
    { enabled: shouldResolveEns }
  );
  const busy = submitResolving || submitting || isLoading;
  const typedResolvedAddress = useMemo<Address | null>(() => {
    if (!trimmed) return null;
    if (isHexAddress) return trimmed as Address;
    return resolvedEnsAddress && isAddress(resolvedEnsAddress)
      ? (resolvedEnsAddress as Address)
      : null;
  }, [isHexAddress, resolvedEnsAddress, trimmed]);
  const typedAddressAlreadyStaged = typedResolvedAddress
    ? pending.some((entry) => entry.toLowerCase() === typedResolvedAddress.toLowerCase())
    : false;
  const typedEntryCommitReady = Boolean(typedResolvedAddress) && !typedAddressAlreadyStaged;
  const typedInputInvalid = Boolean(trimmed) && !resolvingEns && !typedResolvedAddress;

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

  const stage = (address: Address) => {
    setPending((prev) =>
      prev.some((entry) => entry.toLowerCase() === address.toLowerCase())
        ? prev
        : [...prev, address]
    );
  };

  const handleAddToList = async () => {
    setError("");
    const resolved = await resolveInput();
    if (!resolved) {
      setError(formatMessage({ id: "app.admin.roles.error.ensResolutionFailed" }));
      return;
    }
    stage(resolved);
    setInput("");
  };

  const removeEntry = (address: Address) =>
    setPending((prev) => prev.filter((entry) => entry !== address));

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

    const failed: Address[] = [];
    let processedCount = 0;
    let batch = pending;
    try {
      // Fold a typed-but-not-yet-staged address into the batch so a single
      // entry doesn't require the extra "Add" tap. ENS submit resolution is
      // marked busy before awaiting so close paths cannot continue into a
      // wallet write after the operator cancels.
      if (trimmed) {
        if (!isHexAddress) setSubmitResolving(true);
        const resolved = await resolveInput();
        if (!resolved) {
          setError(formatMessage({ id: "app.admin.roles.error.ensResolutionFailed" }));
          return;
        }
        batch = pending.some((entry) => entry.toLowerCase() === resolved.toLowerCase())
          ? pending
          : [...pending, resolved];
      }

      if (batch.length === 0) {
        setError(formatMessage({ id: "app.admin.roles.error.addressRequired" }));
        return;
      }

      setSubmitResolving(false);
      setSubmitting(true);
      for (const [index, address] of batch.entries()) {
        const result = await onAdd(selectedRole, address);
        processedCount = index + 1;
        if (!result.success) failed.push(address);
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

  const formId = "admin-add-members-dialog";
  const batchCount = pending.length + (typedEntryCommitReady ? 1 : 0);
  const closeAndReset = () => {
    resetDraft();
    onClose();
  };
  // Confirm-before-discard: a staged batch (or typed input) is unsaved
  // operator input, so X/scrim/Escape confirm first. The footer Cancel still
  // exits directly per the dialog contract.
  const dirtyClose = useDirtyClose({
    isDirty: pending.length > 0 || Boolean(trimmed),
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
          defaultMessage: "Stage one or more addresses, then add them all in one pass.",
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
              {formatMessage(
                {
                  id: "admin.addMember.addCount",
                  defaultMessage: "{count, plural, one {Add # member} other {Add # members}}",
                },
                { count: batchCount }
              )}
            </AdminButton>
          </>
        }
      >
        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label={formatMessage({ id: "app.admin.roles.roleLabel", defaultMessage: "Role" })}
            htmlFor="member-role"
          >
            <NativeSelect
              surface="admin"
              id="member-role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as GardenRole)}
              disabled={busy}
            >
              {GARDEN_ROLE_ORDER.map((role) => (
                <option key={role} value={role}>
                  {formatMessage({ id: `app.roles.${role}` })}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            label={formatMessage({ id: "app.admin.roles.addressLabel" })}
            htmlFor="member-address"
            error={error || undefined}
          >
            <div className="flex flex-col items-stretch gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <TextInput
                  surface="admin"
                  id="member-address"
                  type="text"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setError("");
                  }}
                  className="pr-10"
                  placeholder={formatMessage({
                    id: "admin.addMember.placeholder",
                    defaultMessage: "0x... or name.eth",
                  })}
                  disabled={busy}
                  aria-invalid={!!error || typedInputInvalid}
                  invalid={!!error || typedInputInvalid}
                />
                <button
                  type="button"
                  onClick={handlePaste}
                  disabled={busy}
                  className="absolute right-1 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center text-text-soft hover:text-text-sub disabled:opacity-50"
                  title={formatMessage({
                    id: "admin.addMember.paste",
                    defaultMessage: "Paste from clipboard",
                  })}
                >
                  <RiClipboardLine className="h-4 w-4" />
                </button>
              </div>
              <AdminButton
                type="button"
                variant="tonal"
                onClick={() => handleAddToList()}
                disabled={busy || !typedEntryCommitReady || resolvingEns}
                leadingIcon={<RiAddLine />}
                className="w-full sm:w-auto"
              >
                {formatMessage({ id: "admin.addMember.addToList", defaultMessage: "Add" })}
              </AdminButton>
            </div>
            {shouldResolveEns && (
              <p className="mt-2 text-xs text-text-soft">
                {resolvingEns ? (
                  formatMessage({
                    id: "admin.addMember.resolvingEns",
                    defaultMessage: "Resolving ENS name...",
                  })
                ) : resolvedEnsAddress ? (
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
                )}
              </p>
            )}
          </FormField>

          {/* Reserved-geometry staging area: fixed height from first paint so
            adding names never grows the dialog (§ dialog standard — loading/
            list regions reserve their final dimensions). */}
          <div
            className="h-44 overflow-y-auto rounded-[var(--m3-shape-md)] border border-stroke-soft bg-bg-weak/40 p-2"
            role="group"
            aria-label={formatMessage({
              id: "admin.addMember.pendingList",
              defaultMessage: "Members to add",
            })}
          >
            {pending.length === 0 ? (
              <p className="flex h-full items-center justify-center px-4 text-center text-xs text-text-soft">
                {formatMessage({
                  id: "admin.addMember.stagedEmpty",
                  defaultMessage: "Resolved addresses appear here before they are added.",
                })}
              </p>
            ) : (
              <ul className="space-y-2">
                {pending.map((address) => (
                  <li
                    key={address}
                    className="flex items-center justify-between gap-2 rounded-[var(--m3-shape-md)] bg-[rgb(var(--m3-surface-container))] px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-body-md text-text-strong">
                      <EnsAddressText address={address} />
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEntry(address)}
                      disabled={busy}
                      aria-label={formatMessage({
                        id: "admin.addMember.remove",
                        defaultMessage: "Remove",
                      })}
                      className="shrink-0 text-text-soft hover:text-text-sub disabled:opacity-50"
                    >
                      <RiCloseLine className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
