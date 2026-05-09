import {
  type Address,
  cn,
  copyToClipboard,
  DialogShell,
  formatAddress,
  type Garden,
  type GardenerCard,
  toastService,
  useEnsAvatar,
  useEnsName,
  useGreenGoodsEnsName,
} from "@green-goods/shared";
import {
  RiCalendarEventFill,
  RiFileCopyLine,
  RiMailFill,
  RiPhoneLine,
  RiUserLine,
  RiWallet3Fill,
} from "@remixicon/react";
import React, { forwardRef, memo, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { FixedSizeList as List } from "react-window";
import { Button } from "@/components/Actions";
import { Badge, EmptyState } from "@/components/Communication";
import { Avatar, AvatarFallback, AvatarImage, AvatarSkeleton } from "@/components/Display";
import { AddressCopy } from "@/components/Inputs";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";

export type GardenMember = GardenerCard & {
  account: Address;
  isOperator: boolean;
  isGardener: boolean;
};

interface GardenGardenersProps {
  members: GardenMember[];
  garden?: Garden;
}

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
  const { data: greenGoodsEnsName } = useGreenGoodsEnsName(member.account);
  const { data: ensName } = useEnsName(member.account);
  const { data: ensAvatar, isLoading: isLoadingAvatar } = useEnsAvatar(member.account);
  const preferredEnsName = greenGoodsEnsName || ensName;
  const displayName =
    member.username ||
    member.email ||
    member.phone ||
    (member.account ? formatAddress(member.account, { ensName: preferredEnsName }) : null) ||
    intl.formatMessage({
      id: "app.garden.gardeners.unknownUser",
      description: "Unknown User",
    });
  const subline = member.account
    ? formatAddress(member.account, { variant: "card", ensName: preferredEnsName })
    : member.email || member.phone || "";

  // Priority: uploaded avatar > ENS avatar > fallback
  const avatarSrc = member.avatar || ensAvatar || "/images/avatar.png";
  const showLoading = !member.avatar && isLoadingAvatar;

  return (
    <button
      className={cn(
        "cv-member relative flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-2 text-left shadow-sm tap-feedback transition-[background-color,border-color,box-shadow,transform] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] focus:outline-none",
        pwaStatusStyles.primary.focus
      )}
      onClick={onClick}
      type="button"
    >
      {member.isOperator ? (
        <Badge
          variant="pill"
          tint="secondary"
          className="absolute top-2 right-2 text-xs font-semibold"
          aria-label={intl.formatMessage({
            id: "app.garden.gardeners.operatorBadge",
            defaultMessage: "Operator",
          })}
        >
          {intl.formatMessage({
            id: "app.garden.gardeners.operatorBadge",
            defaultMessage: "Operator",
          })}
        </Badge>
      ) : null}
      <Avatar className="w-10 h-10">
        {showLoading ? (
          <AvatarSkeleton />
        ) : (
          <>
            <AvatarImage src={avatarSrc} alt="Profile" loading="lazy" decoding="async" />
            <AvatarFallback />
          </>
        )}
      </Avatar>
      <div className="flex flex-col pr-14 min-w-0">
        <span className="truncate font-semibold" title={displayName}>
          {displayName}
        </span>
        {subline ? (
          <span className="truncate text-xs text-text-sub-600" title={subline}>
            {subline}
          </span>
        ) : null}
        <span className="text-xs text-text-sub-600 flex items-center gap-1">
          <RiCalendarEventFill className="w-3.5 h-3.5 text-primary" />
          {intl.formatMessage({ id: "app.garden.gardeners.registered", description: "Registered" })}
          : {new Date(member.registeredAt || garden?.createdAt || Date.now()).toDateString()}
        </span>
      </div>
    </button>
  );
});

export const GardenGardeners = forwardRef<HTMLUListElement, GardenGardenersProps>(
  ({ members, garden }, ref) => {
    const intl = useIntl();
    const shouldVirtualize = members.length > 40;
    const [selected, setSelected] = useState<GardenMember | null>(null);
    const { data: selectedGreenGoodsEnsName } = useGreenGoodsEnsName(selected?.account);
    const { data: selectedEnsName } = useEnsName(selected?.account);
    const selectedPreferredEnsName = selectedGreenGoodsEnsName || selectedEnsName;
    const title = useMemo(() => {
      if (!selected) return "";
      return (
        selected.username ||
        selected.email ||
        selected.phone ||
        (selected.account
          ? formatAddress(selected.account, { ensName: selectedPreferredEnsName })
          : selected.id)
      );
    }, [selected, selectedPreferredEnsName]);

    const copy = async (val?: string) => {
      if (!val) return;
      try {
        await copyToClipboard(val);
        toastService.success({
          title: intl.formatMessage({ id: "app.toast.copied", defaultMessage: "Copied" }),
        });
      } catch {
        toastService.error({
          title: intl.formatMessage({
            id: "app.toast.copyFailed",
            defaultMessage: "Copy failed",
          }),
        });
      }
    };

    return (
      <ul className="flex-1" ref={ref}>
        {members.length ? (
          shouldVirtualize ? (
            <List height={600} itemCount={members.length} itemSize={64} width={"100%"}>
              {({ index, style }: { index: number; style: React.CSSProperties }) => (
                <div style={style} className="px-0.5">
                  <GardenMemberItem
                    member={members[index]}
                    garden={garden}
                    onClick={() => setSelected(members[index])}
                  />
                </div>
              )}
            </List>
          ) : (
            <div className="flex flex-col gap-4">
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
          title={title}
          size="lg"
        >
          {selected && (
            <div className="flex flex-col gap-8">
              {selected.account &&
                (selectedPreferredEnsName ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2 text-sm">
                        <RiUserLine className="w-4 h-4 text-primary" />
                        <span className="truncate font-semibold" title={selectedPreferredEnsName}>
                          {selectedPreferredEnsName}
                        </span>
                      </div>
                      <Button
                        variant="neutral"
                        mode="stroke"
                        size="xxsmall"
                        label={intl.formatMessage({
                          id: "app.common.copy",
                          defaultMessage: "Copy",
                        })}
                        leadingIcon={<RiFileCopyLine className="w-4 h-4" />}
                        onClick={() => copy(selectedPreferredEnsName)}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <RiWallet3Fill className="w-4 h-4 text-primary" />
                        <span className="text-text-sub-600 font-mono text-xs">
                          {formatAddress(selected.account)}
                        </span>
                      </div>
                      <Button
                        variant="neutral"
                        mode="stroke"
                        size="xxsmall"
                        label={intl.formatMessage({
                          id: "app.common.copy",
                          defaultMessage: "Copy",
                        })}
                        leadingIcon={<RiFileCopyLine className="w-4 h-4" />}
                        onClick={() => copy(selected.account)}
                      />
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
                    <RiMailFill className="w-4 h-4 text-primary" />
                    <span className="truncate" title={selected.email}>
                      {selected.email}
                    </span>
                  </div>
                  <Button
                    variant="neutral"
                    mode="stroke"
                    size="xxsmall"
                    label={intl.formatMessage({
                      id: "app.common.copy",
                      defaultMessage: "Copy",
                    })}
                    leadingIcon={<RiFileCopyLine className="w-4 h-4" />}
                    onClick={() => copy(selected.email)}
                  />
                </div>
              )}
              {selected.phone && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2 text-sm">
                    <RiPhoneLine className="w-4 h-4 text-primary" />
                    <span className="truncate" title={selected.phone}>
                      {selected.phone}
                    </span>
                  </div>
                  <Button
                    variant="neutral"
                    mode="stroke"
                    size="xxsmall"
                    label={intl.formatMessage({
                      id: "app.common.copy",
                      defaultMessage: "Copy",
                    })}
                    leadingIcon={<RiFileCopyLine className="w-4 h-4" />}
                    onClick={() => copy(selected.phone)}
                  />
                </div>
              )}
            </div>
          )}
        </DialogShell>
      </ul>
    );
  }
);
