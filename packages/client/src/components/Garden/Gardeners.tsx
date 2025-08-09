import React, { forwardRef, memo } from "react";
import { FixedSizeList as List } from "react-window";
import { useIntl } from "react-intl";
import { formatAddress } from "@/utils/text";

interface GardenGardenersProps {
  gardeners: GardenerCard[];
  garden?: Garden;
  handleScroll: (event: React.UIEvent<HTMLUListElement, UIEvent>) => void;
}

const GardenerItem = memo(function GardenerItem({
  user,
  garden,
}: {
  user: GardenerCard;
  garden?: Garden;
}) {
  const intl = useIntl();
  return (
    <li className="flex items-center gap-3 border-slate-200 border rounded-lg p-2 bg-white">
      <img
        className="w-10 h-10 rounded-full"
        src={user.avatar ?? "/images/avatar.png"}
        alt="Profile"
        loading="lazy"
        decoding="async"
      />
      <div className="flex flex-col">
        <span className="font-semibold">
          {(user.account && formatAddress(user.account)) ||
            user?.email ||
            user?.phone ||
            intl.formatMessage({
              id: "app.garden.gardeners.unknownUser",
              description: "Unknown User",
            })}
        </span>
        <span className="text-xs text-slate-600">
          {intl.formatMessage({ id: "app.garden.gardeners.registered", description: "Registered" })}
          : {new Date(user.registeredAt || garden?.createdAt || Date.now()).toDateString()}
        </span>
      </div>
    </li>
  );
});

export const GardenGardeners = forwardRef<HTMLUListElement, GardenGardenersProps>(
  ({ gardeners, garden, handleScroll }, ref) => {
    const intl = useIntl();
    const shouldVirtualize = gardeners.length > 40;
    return (
      <ul className="padded flex-1 pt-80 pb-42" ref={ref} onScroll={handleScroll}>
        {gardeners.length ? (
          shouldVirtualize ? (
            <List height={600} itemCount={gardeners.length} itemSize={64} width={"100%"}>
              {({ index, style }: { index: number; style: React.CSSProperties }) => (
                <div style={style} className="px-0.5">
                  <GardenerItem user={gardeners[index]} garden={garden} />
                </div>
              )}
            </List>
          ) : (
            <div className="flex flex-col gap-4">
              {gardeners.map((user) => (
                <GardenerItem key={user.id} user={user} garden={garden} />
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
      </ul>
    );
  }
);
