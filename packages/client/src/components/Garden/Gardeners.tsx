import React, { forwardRef, memo, useMemo, useState } from "react";
import { FixedSizeList as List } from "react-window";
import { useIntl } from "react-intl";
import { formatAddress } from "@/utils/app/text";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/UI/Avatar/Avatar";
// import { ModalDrawer } from "@/components/UI/ModalDrawer/ModalDrawer";
import { Button } from "@/components/UI/Button";
import {
  RiFileCopyLine,
  RiMailFill,
  RiPhoneLine,
  RiWallet3Fill,
  RiCalendarEventFill,
} from "@remixicon/react";
import toast from "react-hot-toast";

interface GardenGardenersProps {
  gardeners: GardenerCard[];
  garden?: Garden;
}

const GardenerItem = memo(function GardenerItem({
  user,
  garden,
  onClick,
}: {
  user: GardenerCard;
  garden?: Garden;
  onClick?: () => void;
}) {
  const intl = useIntl();
  const displayName =
    user.username ||
    user.email ||
    user.phone ||
    (user.account ? formatAddress(user.account) : null) ||
    intl.formatMessage({
      id: "app.garden.gardeners.unknownUser",
      description: "Unknown User",
    });
  const subline = user.account ? formatAddress(user.account) : user.email || user.phone || "";
  return (
    <li
      className="flex items-center gap-3 border-slate-200 border rounded-lg p-2 bg-white cursor-pointer hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-sm hover:shadow"
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <Avatar className="w-10 h-10">
        <AvatarImage
          src={user.avatar ?? "/images/avatar.png"}
          alt="Profile"
          loading="lazy"
          decoding="async"
        />
        <AvatarFallback />
      </Avatar>
      <div className="flex flex-col">
        <span className="font-semibold">{displayName}</span>
        {subline ? <span className="text-xs text-slate-600">{subline}</span> : null}
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <RiCalendarEventFill className="w-3.5 h-3.5 text-primary" />
          {intl.formatMessage({ id: "app.garden.gardeners.registered", description: "Registered" })}
          : {new Date(user.registeredAt || garden?.createdAt || Date.now()).toDateString()}
        </span>
      </div>
    </li>
  );
});

export const GardenGardeners = forwardRef<HTMLUListElement, GardenGardenersProps>(
  ({ gardeners, garden }, ref) => {
    const intl = useIntl();
    const shouldVirtualize = gardeners.length > 40;
    const [selected, setSelected] = useState<GardenerCard | null>(null);
    const title = useMemo(() => {
      if (!selected) return "";
      return (
        selected.username ||
        selected.email ||
        selected.phone ||
        (selected.account ? formatAddress(selected.account) : selected.id)
      );
    }, [selected]);

    const copy = async (val?: string) => {
      if (!val) return;
      try {
        await navigator.clipboard.writeText(val);
        toast.success(intl.formatMessage({ id: "app.toast.copied", defaultMessage: "Copied" }));
      } catch {
        toast.error(
          intl.formatMessage({ id: "app.toast.copyFailed", defaultMessage: "Copy failed" })
        );
      }
    };

    return (
      <ul className="flex-1" ref={ref}>
        {gardeners.length ? (
          shouldVirtualize ? (
            <List height={600} itemCount={gardeners.length} itemSize={64} width={"100%"}>
              {({ index, style }: { index: number; style: React.CSSProperties }) => (
                <div style={style} className="px-0.5">
                  <GardenerItem
                    user={gardeners[index]}
                    garden={garden}
                    onClick={() => setSelected(gardeners[index])}
                  />
                </div>
              )}
            </List>
          ) : (
            <div className="flex flex-col gap-4">
              {gardeners.map((user) => (
                <GardenerItem
                  key={user.account ?? user.id}
                  user={user}
                  garden={garden}
                  onClick={() => setSelected(user)}
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
            role="dialog"
            aria-modal="true"
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-[min(520px,92vw)] p-5"
              onClick={(e) => e.stopPropagation()}
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
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <RiWallet3Fill className="w-4 h-4 text-primary" />
                      <span>{formatAddress(selected.account)}</span>
                    </div>
                    <Button
                      variant="neutral"
                      mode="stroke"
                      size="xxsmall"
                      label={intl.formatMessage({ id: "app.common.copy", defaultMessage: "Copy" })}
                      leadingIcon={<RiFileCopyLine className="w-4 h-4" />}
                      onClick={() => copy(selected.account)}
                    />
                  </div>
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
