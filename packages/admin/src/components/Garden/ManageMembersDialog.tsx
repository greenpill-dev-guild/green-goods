import { Button } from "@green-goods/shared/components/Button";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import type { RoleRemovalApi } from "@green-goods/shared/hooks/garden/useGardenOperations";
import { logger } from "@green-goods/shared/modules/app/logger";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { RiUserAddLine, RiUserLine } from "@remixicon/react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminDialog, type AdminDialogProps } from "../AdminDialog";
import { DiscardChangesDialog } from "../DiscardChangesDialog";
import { FlowStatusRow } from "../Layout/FlowStatusRow";
import { ManageRolesFilters } from "./ManageRolesFilters";
import { ManageRolesPersonRow } from "./ManageRolesPersonRow";
import { MemberNameReaders, withMemberName } from "./MemberNames";
import {
  blockedRoles,
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
  /** The account the cockpit signs with, so its own Owner and Steward roles stay out of reach. */
  viewerAddress?: Address | null;
  /** The garden every change applies to, named under the title (Interface Principles 4, 9). */
  gardenName: string;
  chainId?: number;
  /** True while a membership write from elsewhere (Add Members) is in flight. */
  isLoading: boolean;
  /** Reads and removes person-and-role pairs on chain. */
  removal: RoleRemovalApi;
  /** A run or a check ended somewhere other than a clean removal, so the roster may be behind. */
  onRosterStale?: () => void;
  /** Opens Add Members, with the person this dialog is showing when it shows one. */
  onAddMembers: (prefill?: Address) => void;
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
  closesByRoute = false,
  tone,
}: ManageMembersDialogProps) {
  const { formatMessage } = useIntl();
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");
  const [scopedTo, setScopedTo] = useState<Address | null>(initialMember ?? null);
  const [selected, setSelected] = useState<ReadonlyMap<string, RolePair>>(() => new Map());
  const [review, setReview] = useState<ReviewState | null>(null);
  const [names, setNames] = useState<ReadonlyMap<string, string>>(() => new Map());
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
  useEffect(() => {
    reviewToken.current += 1;
  }, [open, initialMember, signer]);

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
  const busy = isLoading || running;

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
    let clean = false;
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
      clean = outcomes.every((outcome) => outcome.status === "removed");
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
    if (!clean) onRosterStale?.();
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
  const actionButton = (slot: "primary" | "secondary", action: ReviewMomentAction | null) =>
    action ? (
      <Button
        key={slot}
        type="button"
        emphasis={slot}
        tone={action.danger ? "danger" : "default"}
        size="sm"
        onClick={() => act(action)}
        disabled={action.disabled}
        loading={action.loading}
      >
        {action.label}
      </Button>
    ) : null;

  // Two fixed slots, end-aligned: a secondary and one primary per moment (RUI pp. 60–62).
  let secondary: ReactNode = null;
  let primary: ReactNode;
  if (moment) {
    secondary = actionButton("secondary", moment.secondary);
    primary = actionButton("primary", moment.primary);
  } else if (canManage) {
    secondary = (
      <Button
        key="secondary"
        type="button"
        emphasis="secondary"
        size="sm"
        leadingIcon={<RiUserAddLine className="h-[18px] w-[18px]" aria-hidden="true" />}
        onClick={() => onAddMembers(scopedTo ?? undefined)}
        disabled={busy}
      >
        {formatMessage({ id: "admin.addMember.openAction" })}
      </Button>
    );
    primary = (
      <Button
        key="primary"
        type="button"
        emphasis="primary"
        size="sm"
        onClick={openReview}
        disabled={busy || picks.length === 0}
      >
        {formatMessage({ id: "admin.manageRoles.review" })}
      </Button>
    );
  } else {
    primary = (
      <Button key="primary" type="button" emphasis="tertiary" size="sm" onClick={onClose}>
        {formatMessage({ id: "admin.common.close" })}
      </Button>
    );
  }

  let summary: ReactNode = moment?.note ?? null;
  if (!review && canManage) {
    summary =
      picks.length === 0 ? (
        formatMessage({ id: "admin.manageRoles.selectHint" })
      ) : (
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-text-strong">
            {formatMessage(
              { id: "admin.manageRoles.selection" },
              { roles: picks.length, people: view.pickedRoles.size }
            )}
          </span>
          {view.hiddenPicks > 0 ? (
            <>
              <span>
                {formatMessage(
                  { id: "admin.manageRoles.selectionHidden" },
                  { count: view.hiddenPicks }
                )}
              </span>
              <Button type="button" emphasis="tertiary" size="compact" onClick={showPicked}>
                {formatMessage({ id: "admin.manageRoles.showSelected" })}
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            emphasis="tertiary"
            size="compact"
            onClick={() => setSelected(new Map())}
          >
            {formatMessage({ id: "admin.manageRoles.clearSelection" })}
          </Button>
        </span>
      );
  }

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
          id: review ? "admin.manageRoles.reviewTitle" : "cockpit.community.members.manageRoles",
        })}
        target={gardenName}
        description={
          review
            ? undefined
            : formatMessage({ id: "app.garden.roles.modal.description" }, { count: people.length })
        }
        actions={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <div
              className="mr-auto min-w-0 type-meta text-text-sub empty:hidden"
              aria-live="polite"
            >
              {summary}
            </div>
            {secondary}
            {primary}
          </div>
        }
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
                      disabled={busy}
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
