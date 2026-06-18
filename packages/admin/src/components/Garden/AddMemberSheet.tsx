import {
  type Address,
  FormField,
  logger,
  parseAndFormatError,
  resolveEnsAddress,
  SheetBody,
  SheetFooter,
  TextInput,
  useEnsAddress,
  useGardenOperations,
} from "@green-goods/shared";
import { RiAddLine, RiClipboardLine, RiCloseLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { isAddress } from "viem";
import { EnsAddressText } from "@/components/EnsAddressText";
import { AdminButton } from "../AdminButton";

interface AddMemberSheetProps {
  /** Garden token address — the write target for `useGardenOperations`. */
  gardenAddress: Address;
  /** Close the sheet after successful writes. */
  onClose: () => void;
  /** Request a user-initiated dismiss while preserving parent close guards. */
  onRequestClose?: () => void;
  /** Reports active wallet writes so the shell can block dismiss gestures. */
  onSubmittingChange?: (submitting: boolean) => void;
}

/**
 * Add gardeners to a garden as a left-anchored sheet (creation flow), replacing
 * the centered AddMemberModal for the header "Add member" action.
 *
 * - Opens from any Garden view in ONE click (rendered by GardenSheetDescriptor at
 *   the always-mounted workspace shell), fixing the prior navigate-then-act
 *   two-click where the modal only lived on the members tab.
 * - Supports MULTIPLE addresses in one pass: resolve each (hex or ENS), stage it
 *   in a pending list, then commit them all on submit. Failed writes stay staged
 *   for retry.
 * - Inherits the garden (green) workspace tint from the sheet surface.
 */
export function AddMemberSheet({
  gardenAddress,
  onClose,
  onRequestClose,
  onSubmittingChange,
}: AddMemberSheetProps) {
  const { formatMessage } = useIntl();
  const operations = useGardenOperations(gardenAddress);
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
  const busy = submitResolving || submitting;

  useEffect(() => {
    onSubmittingChange?.(busy);
    return () => onSubmittingChange?.(false);
  }, [busy, onSubmittingChange]);

  const resolveInput = async (): Promise<Address | null> => {
    if (!trimmed) return null;
    if (isAddress(trimmed)) return trimmed;
    try {
      const lookup = resolvedEnsAddress ?? (await resolveEnsAddress(trimmed));
      return lookup && isAddress(lookup) ? lookup : null;
    } catch (err) {
      logger.error("Failed to resolve ENS address for add-member sheet", {
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
        const result = await operations.addGardener(address);
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

  const formId = "admin-add-member-sheet";
  const batchCount = pending.length + (trimmed ? 1 : 0);
  const requestClose = onRequestClose ?? onClose;

  return (
    <>
      <SheetBody>
        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label={formatMessage({ id: "app.admin.roles.addressLabel" })}
            htmlFor="member-address"
            error={error || undefined}
          >
            <div className="flex items-stretch gap-2">
              <div className="relative flex-1">
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
                  aria-invalid={!!error}
                  invalid={!!error}
                />
                <button
                  type="button"
                  onClick={handlePaste}
                  disabled={busy}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex min-h-11 min-w-11 items-center justify-center text-text-soft hover:text-text-sub disabled:opacity-50"
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
                disabled={busy || !trimmed || (shouldResolveEns && resolvingEns)}
                leadingIcon={<RiAddLine />}
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

          {pending.length > 0 && (
            <ul
              className="space-y-2"
              aria-label={formatMessage({
                id: "admin.addMember.pendingList",
                defaultMessage: "Members to add",
              })}
            >
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
        </form>
      </SheetBody>
      <SheetFooter>
        <AdminButton type="button" variant="text" onClick={requestClose} disabled={busy}>
          {formatMessage({ id: "admin.common.cancel", defaultMessage: "Cancel" })}
        </AdminButton>
        <AdminButton
          type="submit"
          form={formId}
          loading={busy}
          disabled={busy || batchCount === 0 || (shouldResolveEns && resolvingEns)}
        >
          {formatMessage(
            {
              id: "admin.addMember.addCount",
              defaultMessage: "{count, plural, one {Add # member} other {Add # members}}",
            },
            { count: batchCount }
          )}
        </AdminButton>
      </SheetFooter>
    </>
  );
}
