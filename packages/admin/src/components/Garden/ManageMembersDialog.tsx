import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { Button } from "@green-goods/shared/components/Button";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import type { RoleRemovalApi } from "@green-goods/shared/hooks/garden/useGardenOperations";
import type { Address } from "@green-goods/shared/types/domain";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import {
  GARDEN_ROLE_ORDER,
  type GardenRole,
} from "@green-goods/shared/utils/blockchain/garden-roles";
import { RiUserAddLine, RiUserLine } from "@remixicon/react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminDialog, type AdminDialogProps } from "../AdminDialog";
import { AdminFilterChip } from "../AdminFilterChip";
import { AdminInputChip } from "../AdminInputChip";
import { AdminSearchToolbar } from "../AdminSearchToolbar";
import { AdminSelect } from "../AdminTextField";
import { DiscardChangesDialog } from "../DiscardChangesDialog";
import { FlowStatusRow, type FlowStatusRowProps } from "../Layout/FlowStatusRow";
import { getRoleLabel } from "./gardenUtils";
import { ManageRolesPersonRow } from "./ManageRolesPersonRow";
import { MemberNameReaders, withMemberName } from "./MemberNames";
import {
  blockedRoles,
  type ManageRolesViewer,
  type MemberPerson,
  memberMatchesSearch,
  peopleFromRoster,
  type RolePair,
  rolePairKey,
} from "./manageRoles";
import { type ReviewPairStatus, type ReviewPerson, RoleRemovalReview } from "./RoleRemovalReview";

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

type RoleFilter = GardenRole | "all" | "selected";
type ReviewPhase = "checking" | "ready" | "running" | "done";

interface ReviewState {
  phase: ReviewPhase;
  people: ReviewPerson[];
  /** The pairs the current or last run sent, by `rolePairKey`. */
  run: string[];
}

const RETRYABLE: ReadonlySet<ReviewPairStatus> = new Set(["failed", "declined", "notSent"]);

function statusOf(review: ReviewState, key: string): ReviewPairStatus | undefined {
  for (const { person, pairs } of review.people) {
    for (const pair of pairs) {
      if (rolePairKey({ address: person.address, role: pair.role }) === key) return pair.status;
    }
  }
  return undefined;
}

function pairsOf(review: ReviewState, statuses: ReadonlySet<ReviewPairStatus>): RolePair[] {
  return review.people.flatMap(({ person, pairs }) =>
    pairs
      .filter((pair) => statuses.has(pair.status))
      .map((pair) => ({ address: person.address, role: pair.role }))
  );
}

function withPairStatus(
  review: ReviewState,
  row: RolePair,
  status: ReviewPairStatus,
  reason?: string
): ReviewState {
  const key = rolePairKey(row);
  return {
    ...review,
    people: review.people.map((entry) => ({
      ...entry,
      pairs: entry.pairs.map((pair) =>
        rolePairKey({ address: entry.person.address, role: pair.role }) === key
          ? { role: pair.role, status, reason }
          : pair
      ),
    })),
  };
}

function tally(review: ReviewState) {
  const count = (status: ReviewPairStatus) =>
    review.people.reduce(
      (total, { pairs }) => total + pairs.filter((pair) => pair.status === status).length,
      0
    );
  const retryable = review.people.reduce(
    (total, { pairs }) => total + pairs.filter((pair) => RETRYABLE.has(pair.status)).length,
    0
  );
  return {
    ready: count("ready"),
    removed: count("removed"),
    checking: count("checking"),
    alreadyRemoved: count("alreadyRemoved"),
    refused: count("refused"),
    declined: count("declined"),
    unknown: count("unknown"),
    retryable,
    people: review.people.length,
    pairs: review.people.reduce((total, { pairs }) => total + pairs.length, 0),
  };
}

/**
 * Manage Roles: the one place a steward changes who holds which role in the garden.
 *
 * One row per person with a check chip for each role they hold (DL-049); a checked chip picks
 * that person-and-role pair for removal. Search and filters change what shows, never what is
 * picked, and the footer counts the picks in roles and people and says how many are out of
 * view. Review opens in the same shell at the same size, names the garden under the title,
 * reads every pair on chain again, and lists what each person loses and keeps. Its confirm is
 * the flow's one destructive button. Each pair takes its own signature; the run shows each
 * landing in place and ends on a result that says what landed before it offers anything again.
 */
export function ManageMembersDialog({
  open,
  initialMember,
  onClose,
  roleMembers,
  canManage,
  viewerIsOwner,
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
  const intl = useIntl();
  const { formatMessage } = intl;
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");
  const [scopedTo, setScopedTo] = useState<Address | null>(initialMember ?? null);
  const [selected, setSelected] = useState<ReadonlyMap<string, RolePair>>(() => new Map());
  const [review, setReview] = useState<ReviewState | null>(null);
  const [names, setNames] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [shownFor, setShownFor] = useState({ open, initialMember });
  // Async answers belong to the review that asked; a newer opening or review drops them.
  const reviewToken = useRef(0);
  const reviewRegionRef = useRef<HTMLDivElement | null>(null);

  // Each opening, and each change of the person it opens for, starts over. Resetting here,
  // rather than remounting through a key, keeps the closing dialog mounted for its exit motion.
  if (open !== shownFor.open || initialMember !== shownFor.initialMember) {
    setShownFor({ open, initialMember });
    if (open) {
      reviewToken.current += 1;
      setFilter("all");
      setSearch("");
      setScopedTo(initialMember ?? null);
      setSelected(new Map());
      setReview(null);
    }
  }

  const onName = useCallback(
    (address: Address, name: string | null) =>
      setNames((current) => withMemberName(current, address, name)),
    []
  );

  const people = useMemo(() => peopleFromRoster(roleMembers), [roleMembers]);
  const viewer = useMemo<ManageRolesViewer>(
    () => ({ address: viewerAddress, isOwner: viewerIsOwner, canManage }),
    [canManage, viewerAddress, viewerIsOwner]
  );
  const ownerCount = roleMembers.owner?.length ?? 0;
  const blockedByPerson = useMemo(
    () =>
      new Map(
        people.map((person) => [
          person.address.toLowerCase(),
          blockedRoles(person, viewer, ownerCount),
        ])
      ),
    [ownerCount, people, viewer]
  );
  const readOnly = !canManage;

  // A pick counts while its person still holds the role and this viewer may still remove it.
  const picks = useMemo(() => {
    const byAddress = new Map(people.map((person) => [person.address.toLowerCase(), person]));
    return [...selected.values()].filter((pair) => {
      const key = pair.address.toLowerCase();
      return (
        byAddress.get(key)?.roles.includes(pair.role) && !blockedByPerson.get(key)?.has(pair.role)
      );
    });
  }, [blockedByPerson, people, selected]);
  const pickedAddresses = useMemo(
    () => new Set(picks.map((pair) => pair.address.toLowerCase())),
    [picks]
  );

  const availableRoles = GARDEN_ROLE_ORDER.filter((role) => (roleMembers[role]?.length ?? 0) > 0);
  const activeFilter: RoleFilter =
    filter === "selected"
      ? picks.length > 0
        ? "selected"
        : "all"
      : filter === "all" || availableRoles.includes(filter)
        ? filter
        : "all";

  const visiblePeople = useMemo(() => {
    if (scopedTo) {
      return people.filter((person) => person.address.toLowerCase() === scopedTo.toLowerCase());
    }
    return people.filter((person) => {
      if (activeFilter === "selected" && !pickedAddresses.has(person.address.toLowerCase())) {
        return false;
      }
      if (
        activeFilter !== "all" &&
        activeFilter !== "selected" &&
        !person.roles.includes(activeFilter)
      ) {
        return false;
      }
      return memberMatchesSearch(
        person,
        search,
        names.get(person.address.toLowerCase()),
        formatMessage
      );
    });
  }, [activeFilter, formatMessage, names, people, pickedAddresses, scopedTo, search]);
  const visibleAddresses = new Set(visiblePeople.map((person) => person.address.toLowerCase()));
  const hiddenPicks = picks.filter((pair) => !visibleAddresses.has(pair.address.toLowerCase()));

  const running = review?.phase === "running";
  const busy = isLoading || running;

  const toggle = (person: MemberPerson, role: GardenRole, checked: boolean) => {
    const pair = { address: person.address, role };
    const key = rolePairKey(pair);
    setSelected((current) => {
      const next = new Map(current);
      if (checked) next.set(key, pair);
      else next.delete(key);
      return next;
    });
  };

  const showPicked = () => {
    setScopedTo(null);
    setSearch("");
    setFilter("selected");
  };

  const clearPicks = () => setSelected(new Map());

  const settleCheck = (token: number, rows: RolePair[], held: (boolean | null)[]) => {
    if (token !== reviewToken.current) return;
    const gone = new Set(rows.filter((_, index) => held[index] === false).map(rolePairKey));
    setReview((current) =>
      current
        ? {
            ...current,
            phase: "ready",
            people: current.people.map((entry) => ({
              ...entry,
              pairs: entry.pairs.map((pair) => ({
                role: pair.role,
                status: gone.has(rolePairKey({ address: entry.person.address, role: pair.role }))
                  ? "alreadyRemoved"
                  : "ready",
              })),
            })),
          }
        : current
    );
  };

  const openReview = () => {
    const order = new Map(people.map((person, index) => [person.address.toLowerCase(), index]));
    const byPerson = new Map<string, ReviewPerson>();
    for (const pair of picks) {
      const key = pair.address.toLowerCase();
      const person = people[order.get(key) ?? -1];
      if (!person) continue;
      const entry = byPerson.get(key) ?? {
        person: { address: person.address, roles: [...person.roles] },
        pairs: [],
      };
      entry.pairs.push({ role: pair.role, status: "checking" });
      byPerson.set(key, entry);
    }
    const reviewPeople = [...byPerson.entries()]
      .sort(([a], [b]) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
      .map(([, entry]) => ({
        ...entry,
        pairs: [...entry.pairs].sort(
          (a, b) => GARDEN_ROLE_ORDER.indexOf(a.role) - GARDEN_ROLE_ORDER.indexOf(b.role)
        ),
      }));
    reviewToken.current += 1;
    const token = reviewToken.current;
    setReview({ phase: "checking", people: reviewPeople, run: [] });
    const rows = reviewPeople.flatMap(({ person, pairs }) =>
      pairs.map((pair) => ({ address: person.address, role: pair.role }))
    );
    removal
      .check(rows)
      .then((held) => settleCheck(token, rows, held))
      // A failed read leaves every pair to the read before its own signature.
      .catch(() => settleCheck(token, rows, []));
  };

  const backToChoose = () => {
    reviewToken.current += 1;
    setReview(null);
  };

  const send = async (pairs: RolePair[]) => {
    if (pairs.length === 0) return;
    reviewToken.current += 1;
    const token = reviewToken.current;
    const update = (row: RolePair, status: ReviewPairStatus, reason?: string) => {
      if (token !== reviewToken.current) return;
      setReview((current) => (current ? withPairStatus(current, row, status, reason) : current));
    };
    setReview((current) => {
      if (!current) return current;
      let next: ReviewState = { ...current, phase: "running", run: pairs.map(rolePairKey) };
      for (const pair of pairs) next = withPairStatus(next, pair, "ready");
      return next;
    });
    let clean = true;
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
      settled = pairs.filter((_, index) =>
        ["removed", "alreadyRemoved", "refused"].includes(outcomes[index]?.status ?? "")
      );
    } catch {
      // The run itself broke: whatever had not settled may or may not have landed.
      clean = false;
      setReview((current) => {
        if (!current || token !== reviewToken.current) return current;
        let next = current;
        for (const pair of pairs) {
          const status = statusOf(next, rolePairKey(pair));
          if (status === "ready" || status === "sending") {
            next = withPairStatus(next, pair, "unknown");
          }
        }
        return next;
      });
    }
    if (token !== reviewToken.current) return;
    setReview((current) => (current ? { ...current, phase: "done" } : current));
    // Settled pairs leave the picks; a declined or unsent one stays picked for Back.
    setSelected((current) => {
      const next = new Map(current);
      for (const pair of settled) next.delete(rolePairKey(pair));
      return next;
    });
    if (!clean) onRosterStale?.();
  };

  const checkAgain = async () => {
    if (!review) return;
    const unknown = pairsOf(review, new Set(["unknown"]));
    reviewToken.current += 1;
    const token = reviewToken.current;
    for (const pair of unknown) {
      setReview((current) => (current ? withPairStatus(current, pair, "checking") : current));
    }
    const held = await removal.check(unknown).catch((): (boolean | null)[] => []);
    if (token !== reviewToken.current) return;
    for (const [index, pair] of unknown.entries()) {
      const answer = held[index];
      setReview((current) =>
        current
          ? withPairStatus(
              current,
              pair,
              answer === false ? "removed" : answer === true ? "failed" : "unknown"
            )
          : current
      );
    }
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

  const counts = review ? tally(review) : null;
  const sendable = counts ? counts.ready : 0;
  const retryPairs = review ? pairsOf(review, RETRYABLE) : [];

  const removeLabel = (count: number) =>
    formatMessage({ id: "admin.manageRoles.removeCount" }, { count });
  const remainingLabel = formatMessage(
    { id: "admin.manageRoles.removeRemaining" },
    { count: retryPairs.length }
  );

  let status: FlowStatusRowProps | null = null;
  if (review && counts) {
    if (review.phase === "checking" || (review.phase === "done" && counts.checking > 0)) {
      status = {
        tone: "neutral",
        busy: true,
        title: formatMessage({ id: "admin.manageRoles.checking.title" }),
        description: formatMessage({ id: "admin.manageRoles.checking.body" }),
      };
    } else if (review.phase === "ready") {
      const stale =
        counts.alreadyRemoved > 0
          ? ` ${formatMessage(
              { id: "admin.manageRoles.ready.stale" },
              { count: counts.alreadyRemoved }
            )}`
          : "";
      status =
        sendable > 0
          ? {
              tone: "neutral",
              title: formatMessage(
                { id: "admin.manageRoles.ready.title" },
                {
                  roles: sendable,
                  people: review.people.filter(({ pairs }) =>
                    pairs.some((pair) => pair.status === "ready")
                  ).length,
                }
              ),
              description: `${formatMessage({ id: "admin.manageRoles.ready.body" })}${stale}`,
            }
          : {
              tone: "neutral",
              title: formatMessage({ id: "admin.manageRoles.nothingLeft.title" }),
              description: formatMessage({ id: "admin.manageRoles.nothingLeft.body" }),
            };
    } else if (review.phase === "running") {
      const total = review.run.length;
      const settled = review.run.filter((key) => {
        const pairStatus = statusOf(review, key);
        return pairStatus !== "ready" && pairStatus !== "sending";
      }).length;
      status = {
        tone: "info",
        busy: true,
        title: formatMessage(
          { id: "admin.manageRoles.sending.title" },
          { current: Math.min(total, settled + 1), total }
        ),
        description: formatMessage({ id: "admin.manageRoles.sending.body" }),
        progress: total > 0 ? Math.round((settled / total) * 100) : null,
      };
    } else if (counts.unknown > 0) {
      status = {
        tone: "warning",
        title: formatMessage({ id: "admin.manageRoles.unknown.title" }, { count: counts.unknown }),
        description: formatMessage({ id: "admin.manageRoles.unknown.body" }),
      };
    } else if (counts.retryable > 0) {
      status =
        counts.removed === 0 && counts.declined > 0
          ? {
              tone: "warning",
              title: formatMessage({ id: "admin.manageRoles.declined.title" }),
              description: formatMessage({ id: "admin.manageRoles.declined.body" }),
            }
          : {
              tone: "warning",
              title: formatMessage(
                { id: "admin.manageRoles.partial.title" },
                { removed: counts.removed, left: counts.retryable }
              ),
              description: formatMessage(
                { id: "admin.manageRoles.partial.body" },
                { action: counts.removed > 0 ? remainingLabel : removeLabel(retryPairs.length) }
              ),
            };
    } else if (counts.removed > 0) {
      status = {
        tone: "success",
        title: formatMessage({ id: "admin.manageRoles.done.title" }, { count: counts.removed }),
        description:
          counts.refused > 0
            ? formatMessage({ id: "admin.manageRoles.done.someRefused" }, { count: counts.refused })
            : formatMessage({ id: "admin.manageRoles.done.body" }),
      };
    } else {
      status = {
        tone: "neutral",
        title: formatMessage({ id: "admin.manageRoles.declined.title" }),
        description: formatMessage({ id: "admin.manageRoles.noneRemoved.body" }),
      };
    }
  }

  const signatureLine = (count: number) =>
    count > 0 ? formatMessage({ id: "admin.manageRoles.signatures" }, { count }) : null;

  // Two fixed slots, end-aligned: a secondary and one primary per moment (RUI pp. 60–62).
  let footerNote: string | null = null;
  let secondary: ReactNode = null;
  let primary: ReactNode = null;
  if (!review) {
    if (canManage) {
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
  } else if (review.phase === "checking" || review.phase === "ready") {
    footerNote = signatureLine(sendable);
    secondary = (
      <Button key="secondary" type="button" emphasis="secondary" size="sm" onClick={backToChoose}>
        {formatMessage({ id: "app.common.back" })}
      </Button>
    );
    primary = (
      <Button
        key="primary"
        type="button"
        emphasis="primary"
        tone="danger"
        size="sm"
        onClick={() => void send(pairsOf(review, new Set(["ready"])))}
        disabled={review.phase === "checking" || sendable === 0 || isLoading}
      >
        {removeLabel(sendable || counts?.pairs || 0)}
      </Button>
    );
  } else if (review.phase === "running") {
    footerNote = signatureLine(pairsOf(review, new Set(["ready", "sending"])).length);
    primary = (
      <Button key="primary" type="button" emphasis="primary" tone="danger" size="sm" loading>
        {formatMessage({ id: "admin.manageRoles.removing" })}
      </Button>
    );
  } else if (counts && (counts.unknown > 0 || counts.checking > 0)) {
    secondary = (
      <Button key="secondary" type="button" emphasis="secondary" size="sm" onClick={onClose}>
        {formatMessage({ id: "app.common.done" })}
      </Button>
    );
    primary = (
      <Button
        key="primary"
        type="button"
        emphasis="primary"
        size="sm"
        loading={counts.checking > 0}
        onClick={() => void checkAgain()}
      >
        {formatMessage({ id: "admin.manageRoles.checkAgain" })}
      </Button>
    );
  } else if (counts && counts.retryable > 0) {
    footerNote = signatureLine(retryPairs.length);
    secondary =
      counts.removed === 0 ? (
        <Button key="secondary" type="button" emphasis="secondary" size="sm" onClick={backToChoose}>
          {formatMessage({ id: "app.common.back" })}
        </Button>
      ) : (
        <Button key="secondary" type="button" emphasis="secondary" size="sm" onClick={onClose}>
          {formatMessage({ id: "app.common.done" })}
        </Button>
      );
    primary = (
      <Button
        key="primary"
        type="button"
        emphasis="primary"
        tone="danger"
        size="sm"
        onClick={() => void send(retryPairs)}
        disabled={isLoading}
      >
        {counts.removed === 0 ? removeLabel(retryPairs.length) : remainingLabel}
      </Button>
    );
  } else {
    primary = (
      <Button key="primary" type="button" emphasis="primary" size="sm" onClick={onClose}>
        {formatMessage({ id: "app.common.done" })}
      </Button>
    );
  }

  const selectionSummary =
    !review && canManage ? (
      picks.length > 0 ? (
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-text-strong">
            {formatMessage(
              { id: "admin.manageRoles.selection" },
              { roles: picks.length, people: pickedAddresses.size }
            )}
          </span>
          {hiddenPicks.length > 0 ? (
            <span>
              {formatMessage(
                { id: "admin.manageRoles.selectionHidden" },
                { count: hiddenPicks.length }
              )}
            </span>
          ) : null}
          {hiddenPicks.length > 0 ? (
            <Button type="button" emphasis="tertiary" size="compact" onClick={showPicked}>
              {formatMessage({ id: "admin.manageRoles.showSelected" })}
            </Button>
          ) : null}
          <Button type="button" emphasis="tertiary" size="compact" onClick={clearPicks}>
            {formatMessage({ id: "admin.manageRoles.clearSelection" })}
          </Button>
        </span>
      ) : (
        formatMessage({ id: "admin.manageRoles.selectHint" })
      )
    ) : (
      footerNote
    );

  const roleOptionLabel = (role: GardenRole) => getRoleLabel(role, formatMessage).plural;
  const scopedName = scopedTo
    ? (names.get(scopedTo.toLowerCase()) ?? formatAddress(scopedTo, { variant: "card" }))
    : "";

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
              {selectionSummary}
            </div>
            {secondary}
            {primary}
          </div>
        }
      >
        {review && status ? (
          <div
            ref={reviewRegionRef}
            tabIndex={-1}
            className="space-y-3 outline-none"
            aria-label={formatMessage({ id: "admin.manageRoles.reviewTitle" })}
          >
            <FlowStatusRow {...status} />
            <RoleRemovalReview people={review.people} chainId={chainId} viewer={viewerAddress} />
          </div>
        ) : (
          <div className="@container space-y-3">
            <AdminSearchToolbar
              search={search}
              onSearchChange={(value) => {
                setScopedTo(null);
                setSearch(value);
              }}
              placeholder={formatMessage({ id: "app.garden.detail.community.memberSearch" })}
            />
            {scopedTo ? (
              <AdminInputChip
                label={
                  <AddressDisplay address={scopedTo} list>
                    {(name) => name}
                  </AddressDisplay>
                }
                text={scopedName}
                onRemove={() => setScopedTo(null)}
                removeLabel={formatMessage({ id: "admin.manageRoles.showEveryone" })}
              />
            ) : null}
            <AdminSelect
              className="@[480px]:hidden"
              label={formatMessage({ id: "cockpit.community.members.filterAria" })}
              value={activeFilter}
              onChange={(event) => {
                setScopedTo(null);
                setFilter(event.target.value as RoleFilter);
              }}
            >
              <option value="all">
                {formatMessage({ id: "cockpit.community.members.filterAll" })}
              </option>
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {roleOptionLabel(role)}
                </option>
              ))}
              {picks.length > 0 ? (
                <option value="selected">
                  {formatMessage({ id: "admin.manageRoles.filterSelected" })}
                </option>
              ) : null}
            </AdminSelect>
            <div
              className="hidden flex-wrap gap-2 @[480px]:flex"
              role="group"
              aria-label={formatMessage({ id: "cockpit.community.members.filterAria" })}
            >
              <AdminFilterChip
                label={formatMessage({ id: "cockpit.community.members.filterAll" })}
                selected={!scopedTo && activeFilter === "all"}
                onToggle={() => {
                  setScopedTo(null);
                  setFilter("all");
                }}
              />
              {availableRoles.map((role) => (
                <AdminFilterChip
                  key={role}
                  label={roleOptionLabel(role)}
                  selected={!scopedTo && activeFilter === role}
                  onToggle={() => {
                    setScopedTo(null);
                    setFilter(activeFilter === role ? "all" : role);
                  }}
                />
              ))}
              {picks.length > 0 ? (
                <AdminFilterChip
                  label={formatMessage({ id: "admin.manageRoles.filterSelected" })}
                  selected={!scopedTo && activeFilter === "selected"}
                  onToggle={() =>
                    activeFilter === "selected" && !scopedTo ? setFilter("all") : showPicked()
                  }
                />
              ) : null}
            </div>
            {readOnly ? (
              <p className="type-body text-text-sub">
                {formatMessage({ id: "admin.manageRoles.readOnly" })}
              </p>
            ) : null}
            {visiblePeople.length === 0 ? (
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
                {visiblePeople.map((person) => {
                  const key = person.address.toLowerCase();
                  return (
                    <ManageRolesPersonRow
                      key={key}
                      person={person}
                      chainId={chainId}
                      isViewer={Boolean(viewerAddress) && viewerAddress?.toLowerCase() === key}
                      blocked={blockedByPerson.get(key) ?? new Map()}
                      selected={
                        new Set(
                          picks
                            .filter((pair) => pair.address.toLowerCase() === key)
                            .map((pair) => pair.role)
                        )
                      }
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
