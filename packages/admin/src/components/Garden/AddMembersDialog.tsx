import { Button } from "@green-goods/shared/components/Button";
import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import { useEnsAddress } from "@green-goods/shared/hooks/blockchain/useEnsAddress";
import type { useAddMembersBatch } from "@green-goods/shared/hooks/garden/useGardenOperations";
import { useGardenRoleHat } from "@green-goods/shared/hooks/roles/useGardenRoleHat";
import { logger } from "@green-goods/shared/modules/app/logger";
import type { Address } from "@green-goods/shared/types/domain";
import { compareAddresses } from "@green-goods/shared/utils/blockchain/address";
import { resolveEnsAddress } from "@green-goods/shared/utils/blockchain/ens";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { parseAndFormatError } from "@green-goods/shared/utils/errors/contract-errors";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useIntl } from "react-intl";
import { isAddress } from "viem";
import { AdminDialog, type AdminDialogProps } from "../AdminDialog";
import { DiscardChangesDialog } from "../DiscardChangesDialog";
import { AddMembersEntryStatus } from "./AddMembersEntryStatus";
import { AddMembersEntryField } from "./AddMembersEntryField";
import { MemberRolePicker } from "./MemberRolePicker";
import {
  addMembersSubmitLabel,
  addRoleSubmitLabel,
  buildRolesByAddress,
  canStage,
  checkEntry,
  memberListKey,
  memberRowKey,
  type StagedMember,
} from "./addMembersEntry";
import { heldRowsForMember, runAddMembers, stagedAfterRead } from "./addMembersRun";
import { BatchHoldAlert } from "./BatchHoldAlert";
import { StagedMemberList } from "./StagedMemberList";

export interface AddMembersDialogProps {
  open: boolean;
  onClose: () => void;
  /** Commits one person. `{ success: false }` or a throw keeps that row staged for retry. */
  onAdd: (role: GardenRole, address: Address) => Promise<{ success: boolean }>;
  /** Lets a list go under fewer signatures, and settles an add whose outcome is unknown. */
  batch?: ReturnType<typeof useAddMembersBatch>;
  /** The garden being written to; the chain confirms held roles against it. */
  gardenAddress: Address;
  /**
   * Who holds which role today (the indexed roster). It refuses a role someone already has, confirmed
   * on chain first because the roster can lag, and shows what an add changes for an existing member.
   */
  roleMembers: Record<GardenRole, Address[]>;
  /** Starts the field with this person (the Manage Roles path into promotion). */
  initialAddress?: Address;
  /** Adds one role to this fixed member, without a bulk staging step. */
  memberAddress?: Address;
  /** Disables inputs while the hosting view runs an unrelated write. */
  isLoading?: boolean;
  /** A route item opened it, so the router guards its draft: browser Back asks before dropping it. */
  closesByRoute?: boolean;
  tone?: AdminDialogProps["tone"];
}

/** Bulk membership stages people and roles; role addition fixes one member.
 * Both use the same exact-role checks and signing flow, retaining failed rows for retry. */
export function AddMembersDialog({
  open,
  onClose,
  onAdd,
  batch,
  gardenAddress,
  roleMembers,
  initialAddress,
  memberAddress,
  isLoading = false,
  closesByRoute = false,
  tone,
}: AddMembersDialogProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const statusId = useId();
  const entryAddress = memberAddress ?? initialAddress;
  const [roleChosen, setRoleChosen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<GardenRole>("gardener");
  const [input, setInput] = useState(entryAddress ?? "");
  const [pending, setPending] = useState<StagedMember[]>([]);
  const [error, setError] = useState("");
  const [submitResolving, setSubmitResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shownFor, setShownFor] = useState({ open, entryAddress });
  // The list that came back past its ceilings. It goes one person at a time now the person has seen
  // what that costs. Any change makes it a different list, which gets a fresh try.
  const [overCeilings, setOverCeilings] = useState<string | null>(null);
  const [draftAccount, setDraftAccount] = useState(batch?.account ?? null);
  // A draft is its signer's. A hold is scoped to who sent it, so another account would find held
  // rows unlocked and could send them again. A wallet dropping and coming back is the same person.
  if (batch?.account && !compareAddresses(batch.account, draftAccount)) {
    setDraftAccount(batch.account);
    if (draftAccount) {
      setPending([]);
      setInput(entryAddress ?? "");
      setError("");
      setOverCeilings(null);
      setRoleChosen(false);
    }
  }
  // A send outlives a change of account, and what it left behind is not the new draft's. A layout
  // effect moves the guard with the commit, before an awaited step can resume and read it.
  const draftAccountRef = useRef(draftAccount);
  useLayoutEffect(() => {
    draftAccountRef.current = draftAccount;
  }, [draftAccount]);
  const hold = batch?.hold ?? null;
  const isSettlingHold = batch?.isSettlingHold ?? false;
  const lastReadAt = batch?.lastReadAt ?? 0;
  const landedRows = batch?.saved;
  const heldKeys = new Set(hold?.rows.map(memberRowKey));
  const isHeld = (row: StagedMember) => heldKeys.has(memberRowKey(row));
  const sendable = pending.filter((row) => !isHeld(row));

  // Once per read of a held add, whichever way it came about: what landed leaves
  // the list, and what is still held joins it. The ref is the real trigger.
  const lastAppliedReadRef = useRef(0);
  useEffect(() => {
    if (!lastReadAt || lastAppliedReadRef.current === lastReadAt) return;
    lastAppliedReadRef.current = lastReadAt;
    const heldRows = heldRowsForMember(hold?.rows ?? [], memberAddress);
    setPending((current) => stagedAfterRead(current, heldRows, landedRows ?? []));
    // Restoring an unsettled attempt preserves the role already reviewed for this member.
    if (memberAddress && heldRows[0]) {
      setSelectedRole(heldRows[0].role);
      setRoleChosen(true);
    }
  }, [lastReadAt, hold, landedRows, memberAddress]);

  // Reopening restores the supplied person while keeping the exit animation mounted.
  if (open !== shownFor.open || entryAddress !== shownFor.entryAddress) {
    setShownFor({ open, entryAddress });
    if (open) {
      setInput(entryAddress ?? "");
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
  // The indexed roster answers instantly but can lag a recent grant or revoke,
  // so the chain checks every resolved entry and overrules the roster either
  // way once it answers. Until then, or if the read fails, the roster stands.
  const typedRosterCheck = typedResolvedAddress
    ? checkEntry(typedResolvedAddress, selectedRole, pending, rolesByAddress)
    : null;
  const { wearsHat: typedHeldOnChain } = useGardenRoleHat(
    gardenAddress,
    typedResolvedAddress,
    selectedRole,
    { enabled: typedRosterCheck !== null && typedRosterCheck.kind !== "staged" }
  );
  const typedCheck = typedResolvedAddress
    ? checkEntry(typedResolvedAddress, selectedRole, pending, rolesByAddress, typedHeldOnChain)
    : null;
  const typedEntryCommitReady =
    (!memberAddress || roleChosen) && typedCheck !== null && canStage(typedCheck);
  const typedInputInvalid = Boolean(trimmed) && !resolvingEns && !typedResolvedAddress;

  const resetDraft = () => {
    setInput(memberAddress ?? "");
    setRoleChosen(false);
    // A held row is not the person's to drop: it stays until it settles.
    setPending((current) => current.filter(isHeld));
    setError("");
    setOverCeilings(null);
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

  const removeEntry = (row: StagedMember) => {
    setPending((prev) => prev.filter((entry) => memberRowKey(entry) !== memberRowKey(row)));
    if (memberAddress) {
      setRoleChosen(false);
      setError("");
    }
  };

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
    if (busy || isSettlingHold || (memberAddress && !roleChosen)) return;
    setError("");

    const addFailed = formatMessage({ id: "app.admin.roles.error.addFailed" });
    const sentBy = draftAccount;
    let rows = sendable;
    try {
      // A resolved entry can submit directly. Mark ENS lookup busy before awaiting,
      // so cancellation cannot continue into a wallet write.
      if (trimmed) {
        if (!isHexAddress) setSubmitResolving(true);
        const resolved = await resolveInput();
        if (!resolved) {
          setError(formatMessage({ id: "app.admin.roles.error.ensResolutionFailed" }));
          return;
        }
        if (draftAccountRef.current !== sentBy) return;
        if (stageable(resolved)) rows = [...sendable, { address: resolved, role: selectedRole }];
      }

      if (rows.length === 0) {
        setError(formatMessage({ id: "app.admin.roles.error.addressRequired" }));
        return;
      }

      setSubmitResolving(false);
      setSubmitting(true);
      const run = await runAddMembers({
        rows,
        addOne: onAdd,
        addBatch: batch?.available && memberListKey(rows) !== overCeilings ? batch.add : undefined,
        onLanded: (landed) => setPending((current) => stagedAfterRead(current, [], landed)),
      });
      if (draftAccountRef.current !== sentBy) return;
      setPending((current) => [...current.filter(isHeld), ...run.remaining]);
      if (!memberAddress) setInput("");
      const refusedCount = run.remaining.filter((row) => row.refusal).length;
      if (run.thrown) {
        // Refused rows show their own reasons, so this line names what else stopped the send.
        const { message, parsed } = parseAndFormatError(run.thrown);
        setError(parsed.isKnown ? message : addFailed);
      } else if (refusedCount > 0) {
        setError(formatMessage({ id: "admin.addMember.refused" }, { count: refusedCount }));
      } else if (run.failedCount > 0) {
        setError(addFailed);
      } else if (run.needsMoreSignatures) {
        setOverCeilings(memberListKey(run.remaining));
      } else if (run.remaining.length === 0 && !hold) {
        closeAndReset();
      }
    } catch (err) {
      logger.error("Failed to add members", { error: err, gardenAddress });
      setError(addFailed);
    } finally {
      setSubmitResolving(false);
      setSubmitting(false);
    }
  };

  const heldNote = (row: StagedMember) => {
    if (!isHeld(row)) return null;
    const read = hold?.onChain.find((line) => memberRowKey(line) === memberRowKey(row));
    if (!read) return formatMessage({ id: "admin.addMember.held.unread" });
    return formatMessage({
      id: read.wearsRole ? "admin.addMember.held.onChain" : "admin.addMember.held.notOnChain",
    });
  };

  const formId = "admin-add-members-dialog";
  const batchRows: StagedMember[] =
    typedEntryCommitReady && typedResolvedAddress
      ? [...sendable, { address: typedResolvedAddress, role: selectedRole }]
      : sendable;
  const batchRoles = batchRows.map((entry) => entry.role);
  const batchCount = batchRoles.length;
  const submitLabel = memberAddress
    ? addRoleSubmitLabel(roleChosen ? selectedRole : null, formatMessage)
    : batchCount > 0
      ? addMembersSubmitLabel(batchRoles, selectedRole, formatMessage)
      : formatMessage({ id: "admin.addMember.openAction" });
  const pastCeilings = memberListKey(batchRows) === overCeilings;
  const signatureCount =
    batch?.available && !pastCeilings ? batch.signaturesFor(batchCount) : batchCount;
  // Shown while the list stays as it came back, naming the footer button that sends.
  const ceilingNote = pastCeilings
    ? formatMessage({ id: "admin.addMember.needsMoreSignatures" }, { action: submitLabel })
    : null;
  const closeAndReset = () => {
    // Commits the empty draft first, so a close by route change finds no guard armed.
    flushSync(() => {
      resetDraft();
      setSubmitting(false);
    });
    onClose();
  };
  // Dismissal guards unsaved choices; untouched prefills and protected held rows are clean.
  // Footer Cancel discards directly per the dialog contract.
  const dirtyClose = useDirtyClose({
    isDirty:
      open &&
      (sendable.length > 0 ||
        (memberAddress
          ? roleChosen && !pending.length
          : Boolean(trimmed) && trimmed !== (initialAddress ?? ""))),
    onClose: closesByRoute ? onClose : closeAndReset,
    blockRouteChange: open,
    closesInPlace: !closesByRoute,
    preventRouteChange: submitResolving || submitting,
    onDiscard: resetDraft,
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
        title={formatMessage({
          id: memberAddress ? "admin.members.addRole" : "admin.addMember.title",
        })}
        description={formatMessage({
          id: memberAddress ? "admin.members.roleDescription" : "admin.addMember.description",
        })}
        actions={
          // One row at every width, so this line appearing never moves the buttons under a finger.
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <p className="mr-auto type-meta text-text-soft empty:hidden" aria-live="polite">
              {batchCount > 0
                ? formatMessage({ id: "admin.addMember.signatureCount" }, { count: signatureCount })
                : null}
            </p>
            <Button
              type="button"
              emphasis="tertiary"
              size="sm"
              onClick={closeAndReset}
              disabled={busy}
            >
              {formatMessage({ id: "admin.common.cancel", defaultMessage: "Cancel" })}
            </Button>
            <Button
              size="sm"
              type="submit"
              form={formId}
              loading={submitResolving || submitting}
              disabled={
                busy || isSettlingHold || batchCount === 0 || typedInputInvalid || resolvingEns
              }
            >
              {submitLabel}
            </Button>
          </div>
        }
      >
        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
          {hold ? (
            <BatchHoldAlert
              title={formatMessage({ id: "admin.addMember.hold.title" })}
              body={formatMessage({ id: "admin.addMember.hold.body" })}
              hasUnreadValues={hold.onChain.length < hold.rows.length}
              isSettling={isSettlingHold}
              isSaving={busy}
              onCheckAgain={() => void batch?.checkAgain()}
              onMoveOn={() => void batch?.moveOn()}
            />
          ) : null}
          {memberAddress ? (
            <>
              <MemberRolePicker
                address={memberAddress}
                roles={rolesByAddress.get(memberAddress.toLowerCase()) ?? []}
                value={roleChosen ? selectedRole : null}
                disabled={busy || isSettlingHold || pending.length > 0}
                onChange={(role) => {
                  setSelectedRole(role);
                  setRoleChosen(true);
                  setError("");
                }}
              />
              {error || ceilingNote ? (
                <p role="alert" className="type-body text-error-dark">
                  {error || ceilingNote}
                </p>
              ) : null}
              {roleChosen && typedCheck?.kind === "held" ? (
                <AddMembersEntryStatus
                  id={statusId}
                  typed={trimmed}
                  isHexAddress={isHexAddress}
                  resolvedAddress={typedResolvedAddress}
                  isEnsName={false}
                  isResolvingEns={false}
                  check={typedCheck}
                  selectedRole={selectedRole}
                />
              ) : null}
            </>
          ) : (
            <AddMembersEntryField
              value={input}
              onChange={(value) => {
                setInput(value);
                setError("");
              }}
              onRoleChange={setSelectedRole}
              onPaste={() => void handlePaste()}
              onStage={() => void handleAddToList()}
              disabled={busy}
              stageDisabled={!typedEntryCommitReady || resolvingEns}
              invalid={!!error || typedInputInvalid}
              error={error || ceilingNote || undefined}
              status={{
                id: statusId,
                typed: trimmed,
                isHexAddress,
                resolvedAddress: typedResolvedAddress,
                isEnsName: shouldResolveEns,
                isResolvingEns: resolvingEns,
                check: typedCheck,
                selectedRole,
              }}
            />
          )}

          {!memberAddress || pending.length > 0 ? (
            <StagedMemberList
              members={pending}
              reserveSpace={!memberAddress}
              rolesByAddress={rolesByAddress}
              onRemove={removeEntry}
              disabled={busy || isSettlingHold}
              heldNote={heldNote}
            />
          ) : null}
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
