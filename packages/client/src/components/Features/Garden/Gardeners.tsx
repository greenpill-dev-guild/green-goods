import {
  type GardenContributionDate,
  gardenContributionDetail,
} from "@green-goods/shared/components/GardenContributionDate";
import { useGardenMemberContributions } from "@green-goods/shared/hooks/garden/useGardenMemberContributions";
import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { Button } from "@green-goods/shared/components/Button";
import type { ItemRowDetail } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { PersonRow } from "@green-goods/shared/components/Cards/PersonRow/PersonRow";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { NativeSelect } from "@green-goods/shared/components/Form/ControlPrimitives";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import { useGardenMemberHistory } from "@green-goods/shared/hooks/garden/useGardenMemberHistory";
import type {
  Address,
  Garden,
  GardenerCard,
  GardenMemberHistory,
} from "@green-goods/shared/types/domain";
import { copyToClipboard } from "@green-goods/shared/utils/app/clipboard";
import {
  GARDEN_ROLE_ORDER,
  type GardenRole,
} from "@green-goods/shared/utils/blockchain/garden-roles";
import { RiUserLine } from "@remixicon/react";
import { forwardRef, memo, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { List, type RowComponentProps, useDynamicRowHeight } from "react-window";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { GardenJoinRequestsQueue } from "./GardenJoinRequestsQueue";
import { GardenListHeader } from "./GardenListHeader";
import { GardenMemberDetails } from "./GardenMemberDetails";

export type GardenMember = GardenerCard & {
  account: Address;
  isSteward: boolean;
  isGardener: boolean;
};

interface GardenGardenersProps {
  members: GardenMember[];
  garden?: Garden;
  canManageRequests?: boolean;
}

/** Which members the list shows: everyone, or the holders of one role. */
type RoleFilter = "all" | "steward" | "gardener";
/** The list's order: stewards first as the garden lists them, or by when each member joined. */
type MemberSort = "role" | "newest" | "oldest";
const ROLE_FILTERS: readonly RoleFilter[] = ["all", "steward", "gardener"];
const MEMBER_SORTS: readonly MemberSort[] = ["role", "newest", "oldest"];

/** The app's own picture for someone who has no photo, as the profile shows it. */
const DEFAULT_AVATAR = "/images/avatar.png";

/** A name to show for a member who has published none, before their short address. */
function contactName(member: GardenMember) {
  return member.username || member.email || member.phone || undefined;
}

function memberRoles(member: GardenMember): GardenRole[] {
  return GARDEN_ROLE_ORDER.filter(
    (role) => (role === "steward" && member.isSteward) || (role === "gardener" && member.isGardener)
  );
}

/** The garden's own list of each role's holders. */
const ROLE_HOLDERS: Record<GardenRole, (garden: Garden) => readonly Address[] | undefined> = {
  owner: (garden) => garden.owners,
  steward: (garden) => garden.stewards,
  evaluator: (garden) => garden.evaluators,
  gardener: (garden) => garden.gardeners,
  funder: (garden) => garden.funders,
  community: (garden) => garden.communities,
};

/**
 * Every role a member holds, from the garden's own role lists, which hold while the member
 * history is unavailable, and from the history for a role those lists have not caught up with.
 * The row and the sheet read the same set.
 */
function heldRoles(
  member: GardenMember,
  garden: Garden | undefined,
  history?: GardenMemberHistory
): GardenRole[] {
  const listed = memberRoles(member);
  const account = member.account.toLowerCase();
  return GARDEN_ROLE_ORDER.filter(
    (role) =>
      listed.includes(role) ||
      (garden
        ? (ROLE_HOLDERS[role](garden) ?? []).some((holder) => holder.toLowerCase() === account)
        : false) ||
      history?.roleSince[role] !== undefined
  );
}

/**
 * The members one filter and order show. A member who holds both roles appears once in each
 * filter they match; a member whose join date is unknown sorts last either way.
 */
function visibleMembers(
  members: GardenMember[],
  filter: RoleFilter,
  sort: MemberSort,
  historyByAccount: ReadonlyMap<string, GardenMemberHistory>
) {
  const matching = members.filter(
    (member) =>
      filter === "all" ||
      (filter === "steward" && member.isSteward) ||
      (filter === "gardener" && member.isGardener)
  );
  if (sort === "role") return matching;
  const joinedAt = (member: GardenMember) =>
    historyByAccount.get(member.account.toLowerCase())?.joinedAt ?? null;
  return [...matching].sort((a, b) => {
    const first = joinedAt(a);
    const second = joinedAt(b);
    if (first === null || second === null) return first === null ? (second === null ? 0 : 1) : -1;
    return sort === "newest" ? second - first : first - second;
  });
}

/**
 * One member as a person row (DL-112): their avatar, their name from the shared address
 * display, every role they hold in words on the pill's line (so a steward who also gardens reads
 * as both), and the fact this viewer may read on the detail line.
 */
const GardenMemberItem = memo(function GardenMemberItem({
  member,
  garden,
  history,
  contribution,
  onClick,
}: {
  member: GardenMember;
  garden?: Garden;
  history?: GardenMemberHistory;
  contribution?: Parameters<typeof GardenContributionDate>[0]["contribution"];
  onClick?: () => void;
}) {
  const intl = useIntl();
  const joinedAt = history?.joinedAt;
  const roles = heldRoles(member, garden, history);
  const fact: ItemRowDetail | undefined =
    gardenContributionDetail(contribution, intl) ??
    (joinedAt
      ? {
          text: intl.formatMessage(
            { id: "app.garden.membership.joinedOn", defaultMessage: "Joined {date}" },
            {
              date: intl.formatDate(joinedAt, { year: "numeric", month: "short", day: "numeric" }),
            }
          ),
          dateTime: new Date(joinedAt).toISOString(),
        }
      : undefined);
  return (
    <PersonRow
      className="cv-member"
      address={member.account}
      roles={roles}
      rolesAs="text"
      fallbackName={contactName(member)}
      fallbackAvatar={DEFAULT_AVATAR}
      chainId={garden?.chainId ?? DEFAULT_CHAIN_ID}
      details={fact ? [fact] : undefined}
      onOpen={onClick}
    />
  );
});

type GardenMemberRowData = {
  members: GardenMember[];
  garden?: Garden;
  historyByAccount: ReadonlyMap<string, GardenMemberHistory>;
  contributions: ReturnType<typeof useGardenMemberContributions>;
  onSelect: (member: GardenMember) => void;
};

function GardenMemberRow({
  ariaAttributes,
  index,
  style,
  members,
  garden,
  historyByAccount,
  contributions,
  onSelect,
}: RowComponentProps<GardenMemberRowData>) {
  const member = members[index];
  if (!member) return null;

  return (
    <div {...ariaAttributes} style={style} className="px-0.5 pb-3">
      <GardenMemberItem
        member={member}
        garden={garden}
        contribution={
          contributions.canView ? contributions.byAccount[member.account.toLowerCase()] : undefined
        }
        history={historyByAccount.get(member.account.toLowerCase())}
        onClick={() => onSelect(member)}
      />
    </div>
  );
}

export const GardenGardeners = forwardRef<HTMLUListElement, GardenGardenersProps>(
  ({ members, garden, canManageRequests = false }, ref) => {
    const intl = useIntl();
    const chainId = garden?.chainId ?? DEFAULT_CHAIN_ID;
    const history = useGardenMemberHistory({
      garden: garden?.id as Address | undefined,
      chainId,
    });
    const historyByAccount = useMemo(
      () =>
        new Map(
          history.isError
            ? []
            : history.members.map((member) => [member.account.toLowerCase(), member])
        ),
      [history.isError, history.members]
    );
    const contributions = useGardenMemberContributions({
      garden,
      accounts: members.map((member) => member.account),
    });
    const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
    const [sort, setSort] = useState<MemberSort>("role");
    // Newest and Oldest order by join date, which only the member history knows: while it is
    // unavailable they are disabled and the list keeps the role order the select then shows.
    const datesUnavailable = history.isError;
    const appliedSort: MemberSort = datesUnavailable ? "role" : sort;
    const shown = useMemo(
      () => visibleMembers(members, roleFilter, appliedSort, historyByAccount),
      [members, roleFilter, appliedSort, historyByAccount]
    );
    const shouldVirtualize = shown.length > 40;
    // Include the row's height and the list gap; the row grows with the reader's text size.
    const rowHeight = useDynamicRowHeight({ defaultRowHeight: 100 });
    const [selected, setSelected] = useState<GardenMember | null>(null);
    // The selected member's name to copy: their Green Goods name, then their ENS name.
    const { data: selectedGreenGoodsName } = useGreenGoodsEnsName(selected?.account);
    const { data: selectedEnsName } = useEnsName(selected?.account);

    const copy = async (val?: string) => {
      if (!val) return;
      const copiedOk = await copyToClipboard(val);
      if (!copiedOk) {
        toastService.error({
          title: intl.formatMessage({
            id: "app.toast.copyFailed",
            defaultMessage: "Copy failed",
          }),
        });
        return;
      }
      toastService.success({
        title: intl.formatMessage({ id: "app.toast.copied", defaultMessage: "Copied" }),
      });
    };

    const filterLabel: Record<RoleFilter, string> = {
      all: intl.formatMessage({ id: "app.garden.gardeners.filter.all" }),
      steward: intl.formatMessage({ id: "app.roles.steward.plural" }),
      gardener: intl.formatMessage({ id: "app.roles.gardener.plural" }),
    };
    const sortLabel: Record<MemberSort, string> = {
      role: intl.formatMessage({ id: "app.garden.gardeners.sort.role" }),
      newest: intl.formatMessage({ id: "app.garden.gardeners.sort.newest" }),
      oldest: intl.formatMessage({ id: "app.garden.gardeners.sort.oldest" }),
    };
    const selectedHistory = selected
      ? historyByAccount.get(selected.account.toLowerCase())
      : undefined;

    return (
      <ul className="flex-1" ref={ref}>
        {canManageRequests && garden?.id ? (
          <li className="list-none" role="presentation">
            <GardenJoinRequestsQueue gardenAddress={garden.id as Address} />
          </li>
        ) : null}
        {members.length ? (
          <li className="list-none" role="presentation">
            <GardenListHeader
              status={intl.formatMessage(
                { id: "app.garden.gardeners.count" },
                { count: shown.length }
              )}
              filters={
                <>
                  <NativeSelect
                    aria-label={intl.formatMessage({ id: "app.garden.gardeners.filter.label" })}
                    controlSize="compact"
                    density="condensed"
                    className="w-auto min-w-16 max-w-48 field-sizing-content"
                    value={roleFilter}
                    onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
                  >
                    {ROLE_FILTERS.map((filter) => (
                      <option key={filter} value={filter}>
                        {filterLabel[filter]}
                      </option>
                    ))}
                  </NativeSelect>
                  <NativeSelect
                    aria-label={intl.formatMessage({ id: "app.garden.gardeners.sort.label" })}
                    controlSize="compact"
                    density="condensed"
                    className="w-auto min-w-16 max-w-48 field-sizing-content"
                    value={appliedSort}
                    onChange={(event) => setSort(event.target.value as MemberSort)}
                  >
                    {MEMBER_SORTS.map((option) => (
                      <option
                        key={option}
                        value={option}
                        disabled={datesUnavailable && option !== "role"}
                      >
                        {sortLabel[option]}
                      </option>
                    ))}
                  </NativeSelect>
                </>
              }
            />
          </li>
        ) : null}
        {shown.length ? (
          shouldVirtualize ? (
            <List
              defaultHeight={600}
              rowComponent={GardenMemberRow}
              rowCount={shown.length}
              rowHeight={rowHeight}
              rowProps={{
                members: shown,
                garden,
                historyByAccount,
                contributions,
                onSelect: setSelected,
              }}
              style={{ height: 600, width: "100%" }}
            />
          ) : (
            <div className="flex flex-col gap-(--gg-list-gap)">
              {shown.map((member) => (
                <GardenMemberItem
                  key={member.account ?? member.id}
                  member={member}
                  garden={garden}
                  contribution={
                    contributions.canView
                      ? contributions.byAccount[member.account.toLowerCase()]
                      : undefined
                  }
                  history={historyByAccount.get(member.account.toLowerCase())}
                  onClick={() => setSelected(member)}
                />
              ))}
            </div>
          )
        ) : members.length ? (
          <EmptyState
            placement="list"
            icon={<RiUserLine />}
            title={intl.formatMessage({ id: "app.garden.gardeners.filter.empty" })}
            action={
              <Button type="button" emphasis="secondary" onClick={() => setRoleFilter("all")}>
                {intl.formatMessage({ id: "app.garden.gardeners.filter.showAll" })}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<RiUserLine />}
            title={intl.formatMessage({
              id: "app.garden.gardeners.noGardeners",
              description: "No gardeners yet",
            })}
          />
        )}

        {/* Member details: tall, so the address and the membership facts open in view (DL-014). */}
        <DialogShell
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          title={
            selected ? (
              // The member's name as their row shows it.
              <AddressDisplay address={selected.account} fallbackLabel={contactName(selected)}>
                {(name) => <span title={name}>{name}</span>}
              </AddressDisplay>
            ) : null
          }
          size="lg"
          sheetSize="tall"
        >
          {selected && (
            <GardenMemberDetails
              account={selected.account}
              // The roles the garden lists, and any other role their history dates (owner, evaluator).
              roles={heldRoles(selected, garden, selectedHistory)}
              fallbackAvatar={DEFAULT_AVATAR}
              chainId={chainId}
              name={selectedGreenGoodsName || selectedEnsName || undefined}
              email={selected.email}
              phone={selected.phone}
              history={selectedHistory}
              historyLoading={history.isLoading}
              historyError={history.isError}
              contribution={contributions.byAccount[selected.account.toLowerCase()]}
              canViewContribution={contributions.canView}
              onCopy={(value) => void copy(value)}
            />
          )}
        </DialogShell>
      </ul>
    );
  }
);
