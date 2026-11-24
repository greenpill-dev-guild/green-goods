import type {
  SheetAction,
  SheetActionsProps,
} from "@green-goods/shared/components/Dialog/SheetActions";
import { useGardenMemberContributions } from "@green-goods/shared/hooks/garden/useGardenMemberContributions";
import { useGardenMemberHistory } from "@green-goods/shared/hooks/garden/useGardenMemberHistory";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import type { RoleRemovalApi } from "@green-goods/shared/hooks/garden/useGardenOperations";
import { logger } from "@green-goods/shared/modules/app/logger";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { RiUserAddLine, RiUserLine } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminDialog, type AdminDialogProps } from "../AdminDialog";
import { DiscardChangesDialog } from "../DiscardChangesDialog";
import { FlowStatusRow } from "../Layout/FlowStatusRow";
import { ManageRolesSelectionSummary } from "./ManageRolesSelectionSummary";
import { ManageRolesFilters } from "./ManageRolesFilters";
import { ManageRolesPersonRow } from "./ManageRolesPersonRow";
import { RestoreRolesNotice, type RestoreRolesNoticeProps } from "./RestoreRolesNotice";
import { MemberNameReaders, withMemberName } from "./MemberNames";
import {
  blockedRoles,
  canAddRolesTo,
  chooseView,
  type MemberPerson,
  peopleFromRoster,
  type RoleFilter,
  type RolePair,
  withPicks,
} from "./manageRoles";
import {
  type ReviewMomentAction,
  type ReviewState,
  reviewFromPicks,
  reviewMoment,
  settledPairs,
  startRun,
  withCheckAgainAnswers,
  withCheckAnswers,
  withPairsStatus,
  withUnsettledUnknown,
} from "./manageRolesReview";
import { type ReviewPairStatus, RoleRemovalReview } from "./RoleRemovalReview";

export interface ManageMembersDialogProps {
  open: boolean;
  gardenAddress?: Address;
  onAddRole?: (address: Address) => void;
  /** The person a directory row opened it for: the list starts with just them. */
  initialMember?: Address;
  onClose: () => void;
  roleMembers: Record<GardenRole, Address[]>;
  /** Owners and stewards change roles; everyone else reads them. */
  canManage: boolean;
  /** An owner removes any role; a steward never changes an owner or another steward's Steward role. */
  viewerIsOwner: boolean;
  viewerCanManageStewards?: boolean;
  allowedRoles?: readonly GardenRole[];
  /** The account the Hub signs with, so its own Owner and Steward roles stay out of reach. */
  viewerAddress?: Address | null;
  /** The garden every change applies to, named under the title (Interface Principles 4, 9). */
  gardenName: string;
  chainId?: number;
  /** True while a membership write from elsewhere (Add Members) is in flight. */
  isLoading: boolean;
  /** Reads and removes person-and-role pairs on chain. */
  removal: RoleRemovalApi;
  /** A run/check finished; indexed membership history may still lag the chain. */
  onRosterStale?: () => void;
  /** Opens Add Members, with the person this dialog is showing when it shows one. */
  onAddMembers: (prefill?: Address) => void;
  /** Restores the roles a person's role gives but they lack; absent where the viewer cannot. */
  restoreRoles?: Pick<RestoreRolesNoticeProps, "check" | "restore" | "signaturesFor">;
  /** A route item opened it, so the router guards a selection: browser Back asks first. */
  closesByRoute?: boolean;
  tone?: AdminDialogProps["tone"];
}

const NOTHING_PICKED: ReadonlySet<GardenRole> = new Set();

/**
 * Pick person-and-role pairs, review live membership, and remove the permitted pairs.
 * Filters preserve selections. Each signature and its outcome remain visible; failed or
 * uncertain removals stay available for reconciliation through manageRolesReview.
 */
export function ManageMembersDialog({
  open,
  gardenAddress,
  onAddRole,
  initialMember,
  onClose,
  roleMembers,
  canManage,
  viewerIsOwner,
  viewerCanManageStewards = false,
  allowedRoles,
  viewerAddress,
  gardenName,
  chainId = DEFAULT_CHAIN_ID,
  isLoading,
  removal,
  onRosterStale,
  onAddMembers,
  restoreRoles,
  closesByRoute = false,
  tone,
}: ManageMembersDialogProps) {
  const { formatMessage } = useIntl();
  const history = useGardenMemberHistory({ garden: open ? gardenAddress : undefined, chainId });
  const contributions = useGardenMemberContributions({
    garden: gardenAddress
      ? { id: gardenAddress, chainId, owners: roleMembers.owner, stewards: roleMembers.steward }
      : undefined,
    accounts: Object.values(roleMembers).flat(),
    enabled: open,
  });
  const historyByAccount = useMemo(
    () => new Map(history.members.map((member) => [member.account.toLowerCase(), member])),
    [history.members]
  );
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");
  const [scopedTo, setScopedTo] = useState<Address | null>(initialMember ?? null);
  const [selected, setSelected] = useState<ReadonlyMap<string, RolePair>>(() => new Map());
  const [review, setReview] = useState<ReviewState | null>(null);
  const [names, setNames] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [restoring, setRestoring] = useState(false);
  // Who signs, with what rights: a review is never signed by an account that did not make it.
  const signer = `${viewerAddress?.toLowerCase() ?? ""}:${viewerIsOwner}:${canManage}:${viewerCanManageStewards}:${allowedRoles?.join(",")}`;
  const [shownFor, setShownFor] = useState({ open, initialMember, signer });
  // Async answers belong to the review that asked; a newer opening or review drops them.
  const reviewToken = useRef(0);
  const reviewRegionRef = useRef<HTMLDivElement | null>(null);

  // Each opening, each change of the person it opens for, and each change of signer starts
  // over. Resetting here, rather than remounting through a key, keeps the closing dialog
  // mounted for its exit motion.
  if (
    open !== shownFor.open ||
    initialMember !== shownFor.initialMember ||
    signer !== shownFor.signer
  ) {
    setShownFor({ open, initialMember, signer });
    if (open) {
      setFilter("all");
      setSearch("");
      setScopedTo(initialMember ?? null);
      setSelected(new Map());
      setReview(null);
    }
  }
  // Each of those, and leaving, drops pending answers: a garden change remounts this dialog, so a
  // restore checked for one garden never reaches the wallet once another garden, or none, is open.
  useEffect(
    () => () => {
      reviewToken.current += 1;
    },
    [open, initialMember, signer]
  );

  const onName = useCallback(
    (address: Address, name: string | null) =>
      setNames((current) => withMemberName(current, address, name)),
    []
  );

  const { people, blocked } = useMemo(() => {
    const roster = peopleFromRoster(roleMembers);
    const viewer = {
      address: viewerAddress,
      isOwner: viewerIsOwner,
      canManage,
      canManageStewards: viewerCanManageStewards,
      allowedRoles,
    };
    const ownerCount = roleMembers.owner?.length ?? 0;
    return {
      people: roster,
      blocked: new Map(
        roster.map((person) => [
          person.address.toLowerCase(),
          blockedRoles(person, viewer, ownerCount),
        ])
      ),
    };
  }, [canManage, roleMembers, viewerAddress, viewerIsOwner, viewerCanManageStewards, allowedRoles]);
  const view = chooseView({
    people,
    blocked,
    selected,
    filter,
    scopedTo,
    search,
    names,
    formatMessage,
  });
  const { picks } = view;
  // A filter that lost its people lets go for good, so a later pick cannot bring it back.
  if (view.activeFilter !== filter) setFilter(view.activeFilter);
  const readOnly = !canManage;
  const running = review?.phase === "running";
  const busy = isLoading || running || restoring;

  const toggle = (person: MemberPerson, role: GardenRole, checked: boolean) =>
    setSelected((current) => withPicks(current, [{ address: person.address, role }], checked));

  const chooseFilter = (next: RoleFilter) => {
    setScopedTo(null);
    setFilter(next);
  };

  const showPicked = () => {
    setSearch("");
    chooseFilter("selected");
  };

  const openReview = () => {
    const { review: next, rows } = reviewFromPicks(picks, people);
    reviewToken.current += 1;
    const token = reviewToken.current;
    const settle = (held: (boolean | null)[]) => {
      if (token !== reviewToken.current) return;
      setReview((current) => current && withCheckAnswers(current, rows, held));
    };
    setReview(next);
    // A failed read leaves every pair to the read before its own signature.
    removal.check(rows).then(settle, (error) => {
      logger.warn("Manage Roles could not read the picked roles", { error, pairs: rows.length });
      settle([]);
    });
  };

  const backToChoose = () => {
    reviewToken.current += 1;
    setReview(null);
  };

  const send = async (pairs: RolePair[]) => {
    if (pairs.length === 0) return;
    reviewToken.current += 1;
    const token = reviewToken.current;
    const live = () => token === reviewToken.current;
    const update = (row: RolePair, status: ReviewPairStatus, reason?: string) => {
      if (!live()) return;
      setReview((current) => current && withPairsStatus(current, [row], status, reason));
    };
    setReview((current) => current && startRun(current, pairs));
    let settled: RolePair[] = [];
    try {
      const outcomes = await removal.remove(pairs, {
        onSending: (row) => update(row, "sending"),
        onSettled: (row, outcome) =>
          update(
            row,
            outcome.status,
            outcome.status === "refused" || outcome.status === "failed" ? outcome.reason : undefined
          ),
      });
      settled = settledPairs(pairs, outcomes);
    } catch (error) {
      // The run itself broke: whatever had not settled may or may not have landed.
      logger.error("Manage Roles stopped a removal run", { error, pairs: pairs.length });
      if (live()) setReview((current) => current && withUnsettledUnknown(current, pairs));
    }
    if (!live()) return;
    setReview((current) => current && { ...current, phase: "done" });
    // Settled pairs leave the picks; a declined or unsent one stays picked for Back.
    setSelected((current) => withPicks(current, settled, false));
    onRosterStale?.();
  };

  const checkAgain = async (pairs: RolePair[]) => {
    if (pairs.length === 0) return;
    reviewToken.current += 1;
    const token = reviewToken.current;
    setReview((current) => current && withPairsStatus(current, pairs, "checking"));
    const held = await removal.check(pairs).catch((error): (boolean | null)[] => {
      logger.warn("Manage Roles could not read the unconfirmed roles", {
        error,
        pairs: pairs.length,
      });
      return [];
    });
    if (token !== reviewToken.current) return;
    setReview((current) => current && withCheckAgainAnswers(current, pairs, held));
    onRosterStale?.();
  };

  // Entering review, and finishing a run, put focus on the review: the steward reads where
  // things stand before the next button, and a second press never lands on the confirm.
  const phase = review?.phase;
  useEffect(() => {
    if (phase === "checking" || phase === "done") reviewRegionRef.current?.focus();
  }, [phase]);

  // A restore holds the dialog from its chain read to its last signature, so no removal, add or
  // other restore can change the person under it; an answer after the dialog closed sends nothing.
  const startRestore = () => {
    const token = reviewToken.current;
    setRestoring(true);
    return { live: () => token === reviewToken.current, end: () => setRestoring(false) };
  };
  // A restore's answer can be newer than both lists, so both are read again.
  const refreshAfterRestore = () => {
    void history.refetch();
    onRosterStale?.();
  };

  const resetDraft = () => {
    reviewToken.current += 1;
    setSelected(new Map());
    setReview(null);
  };
  const dirtyClose = useDirtyClose({
    isDirty: open && canManage && picks.length > 0 && review?.phase !== "done",
    onClose,
    blockRouteChange: closesByRoute,
    preventRouteChange: closesByRoute && running,
    onDiscard: resetDraft,
  });
  const handleOpenChange = (next: boolean) => {
    if (next || running) return;
    dirtyClose.onOpenChange(false);
  };

  const moment = review ? reviewMoment(review, formatMessage, isLoading) : null;
  const act = (action: ReviewMomentAction) => {
    if (action.act === "back") backToChoose();
    else if (action.act === "done") onClose();
    else if (action.act === "checkAgain") void checkAgain(action.pairs ?? []);
    else void send(action.pairs ?? []);
  };
  const actionOf = (action: ReviewMomentAction | null): SheetAction | undefined =>
    action
      ? {
          label: action.label,
          tone: action.danger ? "danger" : "default",
          onClick: () => act(action),
          disabled: action.disabled,
          loading: action.loading,
        }
      : undefined;

  // Two fixed slots: a secondary and one primary per moment (RUI pp. 60–62).
  const footerActions: Pick<SheetActionsProps, "primary" | "secondary"> = moment
    ? { primary: actionOf(moment.primary), secondary: actionOf(moment.secondary) }
    : canManage
      ? {
          primary: {
            label: formatMessage({ id: "admin.manageRoles.review" }),
            onClick: openReview,
            disabled: busy || picks.length === 0,
          },
          secondary: {
            label: formatMessage({ id: "admin.addMember.openAction" }),
            icon: <RiUserAddLine className="h-[18px] w-[18px]" aria-hidden="true" />,
            onClick: () => onAddMembers(scopedTo ?? undefined),
            disabled: busy,
          },
        }
      : { secondary: { label: formatMessage({ id: "admin.common.close" }), onClick: onClose } };

  const summary =
    !review && canManage ? (
      <ManageRolesSelectionSummary
        roles={picks.length}
        people={view.pickedRoles.size}
        hidden={view.hiddenPicks}
        onShow={showPicked}
        onClear={() => setSelected(new Map())}
      />
    ) : (
      (moment?.note ?? null)
    );

  const viewerKey = viewerAddress?.toLowerCase();

  return (
    <>
      <AdminDialog
        open={open}
        onOpenChange={handleOpenChange}
        preventClose={running}
        size="lg"
        height="stable"
        tone={tone}
        title={formatMessage({
          id: review ? "admin.manageRoles.reviewTitle" : "hub.community.members.manageRoles",
        })}
        target={gardenName}
        description={
          review
            ? undefined
            : formatMessage({ id: "app.garden.roles.modal.description" }, { count: people.length })
        }
        actions={{ note: summary ?? null, ...footerActions }}
      >
        {review && moment ? (
          <div
            ref={reviewRegionRef}
            tabIndex={-1}
            className="space-y-3 outline-none"
            aria-label={formatMessage({ id: "admin.manageRoles.reviewTitle" })}
          >
            <FlowStatusRow {...moment.status} />
            <RoleRemovalReview people={review.people} chainId={chainId} viewer={viewerAddress} />
          </div>
        ) : (
          <div className="@container space-y-3">
            <ManageRolesFilters
              search={search}
              onSearchChange={(value) => {
                setScopedTo(null);
                setSearch(value);
              }}
              scopedTo={scopedTo}
              scopedName={scopedTo ? names.get(scopedTo.toLowerCase()) : undefined}
              onShowEveryone={() => setScopedTo(null)}
              roles={view.roles}
              hasPicks={picks.length > 0}
              activeFilter={view.activeFilter}
              onFilterChange={chooseFilter}
              onShowPicked={showPicked}
            />
            {readOnly ? (
              <p className="type-body text-text-sub">
                {formatMessage({ id: "admin.manageRoles.readOnly" })}
              </p>
            ) : null}
            {view.visiblePeople.length === 0 ? (
              <EmptyState
                icon={<RiUserLine className="h-6 w-6" />}
                title={formatMessage({
                  id:
                    people.length === 0
                      ? "app.admin.garden.members.empty"
                      : "app.garden.detail.community.membersEmpty",
                })}
              />
            ) : (
              <ul className="flex flex-col gap-(--gg-list-gap)">
                {view.visiblePeople.map((person) => {
                  const key = person.address.toLowerCase();
                  return (
                    <ManageRolesPersonRow
                      key={key}
                      person={person}
                      chainId={chainId}
                      isViewer={viewerKey === key}
                      blocked={blocked.get(key) ?? new Map()}
                      selected={view.pickedRoles.get(key) ?? NOTHING_PICKED}
                      onToggle={(role, checked) => toggle(person, role, checked)}
                      readOnly={readOnly}
                      history={historyByAccount.get(key)}
                      historyLoading={history.isLoading}
                      historyError={history.isError}
                      contribution={
                        contributions.canView ? contributions.byAccount[key] : undefined
                      }
                      onAddRole={
                        onAddRole &&
                        canAddRolesTo(person, {
                          isOwner: viewerIsOwner,
                          canManageStewards: viewerCanManageStewards,
                        })
                          ? () => onAddRole(person.address)
                          : undefined
                      }
                      addRoleDisabled={picks.length > 0}
                      disabled={busy}
                      restoreNotice={
                        restoreRoles ? (
                          <RestoreRolesNotice
                            address={person.address}
                            roles={person.roles}
                            recordedRoles={
                              history.isError ? undefined : historyByAccount.get(key)?.recordedRoles
                            }
                            allowedRoles={allowedRoles}
                            disabled={busy || picks.length > 0}
                            onRosterStale={refreshAfterRestore}
                            startRun={startRestore}
                            {...restoreRoles}
                          />
                        ) : undefined
                      }
                    />
                  );
                })}
              </ul>
            )}
            <MemberNameReaders addresses={people.map((person) => person.address)} onName={onName} />
          </div>
        )}
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
