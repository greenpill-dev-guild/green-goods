import React, { forwardRef, memo, useMemo, useState } from "react";
import { FixedSizeList as List } from "react-window";
import { useIntl } from "react-intl";
import { useEnsName } from "@green-goods/shared/hooks";
import { copyToClipboard, formatAddress } from "@green-goods/shared/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/UI/Avatar/Avatar";
import { Button } from "@/components/UI/Button";
import { Badge } from "@/components/UI/Badge/Badge";
import {
  RiFileCopyLine,
  RiMailFill,
  RiPhoneLine,
  RiWallet3Fill,
  RiCalendarEventFill,
} from "@remixicon/react";
import toast from "react-hot-toast";
import { AddressCopy } from "@/components/UI/Clipboard";

export type GardenMember = GardenerCard & {
  account: string;
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
  const { data: ensName } = useEnsName(member.account);
  const displayName =
    member.username ||
    member.email ||
    member.phone ||
    (member.account ? formatAddress(member.account, { ensName }) : null) ||
    intl.formatMessage({
      id: "app.garden.gardeners.unknownUser",
      description: "Unknown User",
    });
  const subline = member.account
    ? formatAddress(member.account, { variant: "card", ensName })
    : member.email || member.phone || "";
  return (
    <button
      className="relative flex items-center gap-3 border-slate-200 border rounded-lg p-2 bg-white cursor-pointer hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-sm hover:shadow w-full text-left"
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
        <AvatarImage
          src={member.avatar ?? "/images/avatar.png"}
          alt="Profile"
          loading="lazy"
          decoding="async"
        />
        <AvatarFallback />
      </Avatar>
      <div className="flex flex-col pr-14">
        <span className="font-semibold">{displayName}</span>
        {subline ? <span className="text-xs text-slate-600">{subline}</span> : null}
        <span className="text-xs text-slate-500 flex items-center gap-1">
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
    const { data: selectedEnsName } = useEnsName(selected?.account);
    const title = useMemo(() => {
      if (!selected) return "";
      return (
        selected.username ||
        selected.email ||
        selected.phone ||
        (selected.account
          ? formatAddress(selected.account, { ensName: selectedEnsName })
          : selected.id)
      );
    }, [selected, selectedEnsName]);

    const copy = async (val?: string) => {
      if (!val) return;
      try {
        await copyToClipboard(val);
        toast.success(intl.formatMessage({ id: "app.toast.copied", defaultMessage: "Copied" }));
      } catch {
        const failed = intl.formatMessage({
          id: "app.toast.copyFailed",
          defaultMessage: "Copy failed",
        });
        toast.error(failed);
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
          <p className="grid place-items-center p-8 text-center text-sm italic">
            {intl.formatMessage({
              id: "app.garden.gardeners.noGardeners",
              description: "No gardeners yet",
            })}
          </p>
        )}

        {/* Centered popover-style dialog instead of bottom drawer */}
        {selected && (
          <div
            className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setSelected(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSelected(null);
              }
            }}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-[min(520px,92vw)] p-5"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-base font-semibold truncate">{title}</div>
                <Button
                  variant="neutral"
                  mode="stroke"
                  size="xxsmall"
                  label={intl.formatMessage({ id: "app.common.close", defaultMessage: "Close" })}
                  onClick={() => setSelected(null)}
                />
              </div>
              <div className="flex flex-col gap-3">
                {selected.account && (
                  <AddressCopy
                    address={selected.account}
                    ensName={selectedEnsName}
                    icon={<RiWallet3Fill className="h-4 w-4" />}
                  />
                )}
                {selected.email && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <RiMailFill className="w-4 h-4 text-primary" />
                      <span>{selected.email}</span>
                    </div>
                    <Button
                      variant="neutral"
                      mode="stroke"
                      size="xxsmall"
                      label={intl.formatMessage({ id: "app.common.copy", defaultMessage: "Copy" })}
                      leadingIcon={<RiFileCopyLine className="w-4 h-4" />}
                      onClick={() => copy(selected.email)}
                    />
                  </div>
                )}
                {selected.phone && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <RiPhoneLine className="w-4 h-4 text-primary" />
                      <span>{selected.phone}</span>
                    </div>
                    <Button
                      variant="neutral"
                      mode="stroke"
                      size="xxsmall"
                      label={intl.formatMessage({ id: "app.common.copy", defaultMessage: "Copy" })}
                      leadingIcon={<RiFileCopyLine className="w-4 h-4" />}
                      onClick={() => copy(selected.phone)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </ul>
    );
  }
);
