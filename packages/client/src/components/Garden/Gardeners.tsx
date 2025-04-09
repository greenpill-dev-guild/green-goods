import { formatAddress } from "@/utils/text";
import { forwardRef } from "react";

interface GardenGardenersProps {
  gardeners: GardenerCard[];
  handleScroll: (event: React.UIEvent<HTMLUListElement, UIEvent>) => void;
}

export const GardenGardeners = forwardRef<
  HTMLUListElement,
  GardenGardenersProps
>(({ gardeners, handleScroll }, ref) => {
  return (
    <ul className="flex flex-col gap-2" ref={ref} onScroll={handleScroll}>
      {gardeners.length ?
        gardeners.map((user) => (
          <li
            key={user.id}
            className="flex items-center gap-3 border-slate-100 border-2 shadow-2xs rounded-lg p-2"
          >
            <img
              className="w-10 h-10"
              src={user.avatar ?? "/images/avatar.png"}
              alt="Profile"
            />
            <div className="flex flex-col">
              <span className="font-semibold">
                {(user.account && formatAddress(user.account)) ||
                  user?.email ||
                  user?.phone ||
                  "Unknown User"}
              </span>
              <span className="text-xs">
                Registered: {user.registeredAt.toDateString()}
              </span>
            </div>
          </li>
        ))
      : <p className="grid place-items-center p-8 text-center text-sm italic">
          No gardeners yet, get started by clicking a garden above
        </p>
      }
    </ul>
  );
});
