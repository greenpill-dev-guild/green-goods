import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { Button } from "@green-goods/shared/components/Button";
import { PersonRow } from "@green-goods/shared/components/Cards/PersonRow/PersonRow";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import type { Address, Garden, GardenerCard } from "@green-goods/shared/types/domain";
import { copyToClipboard } from "@green-goods/shared/utils/app/clipboard";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import {
  RiFileCopyLine,
  RiMailFill,
  RiPhoneLine,
  RiUserLine,
  RiWallet3Fill,
} from "@remixicon/react";
import { forwardRef, memo, useState } from "react";
import { useIntl } from "react-intl";
import { List, type RowComponentProps, useDynamicRowHeight } from "react-window";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { AddressCopy } from "@/components/Inputs";
import { GardenJoinRequestsQueue } from "./GardenJoinRequestsQueue";

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

/** The app's own picture for someone who has no photo, as the profile shows it. */
const DEFAULT_AVATAR = "/images/avatar.png";

/** A name to show for a member who has published none, before their short address. */
function contactName(member: GardenMember) {
  return member.username || member.email || member.phone || undefined;
}

/**
 * One member as a person row (DL-112): their avatar, their name from the shared address
 * display, their highest role as the chip and, as the one fact, since when they have been a
 * gardener.
 */
const GardenMemberItem = memo(function GardenMemberItem({
  member,
  garden,
  onClick,
}: {
  member: GardenMember;
  garden?: Garden;
  onClick?: () => void;
}) {
  const intl = useIntl();
  const roles: GardenRole[] = [
    ...(member.isSteward ? (["steward"] as const) : []),
    ...(member.isGardener ? (["gardener"] as const) : []),
  ];
  // The indexer records one date per gardener, their first gardener role in any garden, so the
  // row says since when they have been a gardener, never when they joined this garden.
  const gardenerSince = member.isGardener && member.registeredAt ? member.registeredAt : null;

  return (
    <PersonRow
      className="cv-member"
      address={member.account}
      roles={roles}
      fallbackName={contactName(member)}
      fallbackAvatar={DEFAULT_AVATAR}
      chainId={garden?.chainId ?? DEFAULT_CHAIN_ID}
      details={
        gardenerSince
          ? [
              {
                text: intl.formatMessage(
                  { id: "app.garden.gardeners.gardenerSince" },
                  {
                    date: intl.formatDate(gardenerSince, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    }),
                  }
                ),
                dateTime: new Date(gardenerSince).toISOString(),
              },
            ]
          : undefined
      }
      onOpen={onClick}
    />
  );
});

type GardenMemberRowData = {
  members: GardenMember[];
  garden?: Garden;
  onSelect: (member: GardenMember) => void;
};

function GardenMemberRow({
  ariaAttributes,
  index,
  style,
  members,
  garden,
  onSelect,
}: RowComponentProps<GardenMemberRowData>) {
  const member = members[index];
  if (!member) return null;

  return (
    <div {...ariaAttributes} style={style} className="px-0.5 pb-3">
      <GardenMemberItem member={member} garden={garden} onClick={() => onSelect(member)} />
    </div>
  );
}

export const GardenGardeners = forwardRef<HTMLUListElement, GardenGardenersProps>(
  ({ members, garden, canManageRequests = false }, ref) => {
    const intl = useIntl();
    const shouldVirtualize = members.length > 40;
    // Include the row's height and the list gap; the row grows with the reader's text size.
    const rowHeight = useDynamicRowHeight({ defaultRowHeight: 100 });
    const [selected, setSelected] = useState<GardenMember | null>(null);
    const { data: selectedGreenGoodsEnsName } = useGreenGoodsEnsName(selected?.account);
    const { data: selectedEnsName } = useEnsName(selected?.account);
    const selectedPreferredEnsName = selectedGreenGoodsEnsName || selectedEnsName;

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

    return (
      <ul className="flex-1" ref={ref}>
        {canManageRequests && garden?.id ? (
          <li className="list-none" role="presentation">
            <GardenJoinRequestsQueue gardenAddress={garden.id as Address} />
          </li>
        ) : null}
        {members.length ? (
          shouldVirtualize ? (
            <List
              defaultHeight={600}
              rowComponent={GardenMemberRow}
              rowCount={members.length}
              rowHeight={rowHeight}
              rowProps={{ members, garden, onSelect: setSelected }}
              style={{ height: 600, width: "100%" }}
            />
          ) : (
            <div className="flex flex-col gap-(--gg-list-gap)">
              {members.map((member) => (
                <GardenMemberItem
                  key={member.account ?? member.id}
                  member={member}
                  garden={garden}
                  onClick={() => setSelected(member)}
                />
              ))}
            </div>
          )
        ) : (
          <EmptyState
            icon={<RiUserLine />}
            title={intl.formatMessage({
              id: "app.garden.gardeners.noGardeners",
              description: "No gardeners yet",
            })}
          />
        )}

        {/* Member detail dialog */}
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
        >
          {selected && (
            <div className="flex flex-col gap-8">
              {selected.account &&
                (selectedPreferredEnsName ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2 text-sm">
                        <RiUserLine className="w-4 h-4 text-primary-on-surface" />
                        <span className="truncate font-semibold" title={selectedPreferredEnsName}>
                          {selectedPreferredEnsName}
                        </span>
                      </div>
                      <Button
                        type="button"
                        emphasis="secondary"
                        size="compact"
                        leadingIcon={<RiFileCopyLine className="h-4 w-4" aria-hidden="true" />}
                        onClick={() => copy(selectedPreferredEnsName)}
                      >
                        {intl.formatMessage({ id: "app.common.copy", defaultMessage: "Copy" })}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <RiWallet3Fill className="w-4 h-4 text-primary-on-surface" />
                        <span className="text-text-sub-600 font-mono text-xs">
                          {formatAddress(selected.account)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        emphasis="secondary"
                        size="compact"
                        leadingIcon={<RiFileCopyLine className="h-4 w-4" aria-hidden="true" />}
                        onClick={() => copy(selected.account)}
                      >
                        {intl.formatMessage({ id: "app.common.copy", defaultMessage: "Copy" })}
                      </Button>
                    </div>
                  </>
                ) : (
                  <AddressCopy
                    address={selected.account}
                    ensName={selectedPreferredEnsName}
                    icon={<RiWallet3Fill className="h-4 w-4" />}
                  />
                ))}
              {selected.email && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2 text-sm">
                    <RiMailFill className="w-4 h-4 text-primary-on-surface" />
                    <span className="truncate" title={selected.email}>
                      {selected.email}
                    </span>
                  </div>
                  <Button
                    type="button"
                    emphasis="secondary"
                    size="compact"
                    leadingIcon={<RiFileCopyLine className="h-4 w-4" aria-hidden="true" />}
                    onClick={() => copy(selected.email)}
                  >
                    {intl.formatMessage({ id: "app.common.copy", defaultMessage: "Copy" })}
                  </Button>
                </div>
              )}
              {selected.phone && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2 text-sm">
                    <RiPhoneLine className="w-4 h-4 text-primary-on-surface" />
                    <span className="truncate" title={selected.phone}>
                      {selected.phone}
                    </span>
                  </div>
                  <Button
                    type="button"
                    emphasis="secondary"
                    size="compact"
                    leadingIcon={<RiFileCopyLine className="h-4 w-4" aria-hidden="true" />}
                    onClick={() => copy(selected.phone)}
                  >
                    {intl.formatMessage({ id: "app.common.copy", defaultMessage: "Copy" })}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogShell>
      </ul>
    );
  }
);
