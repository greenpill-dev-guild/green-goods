import { Gardener } from "@/providers/garden";

interface GardenGardenersProps {
  gardeners: Gardener[];
}

export const GardenGardeners: React.FC<GardenGardenersProps> = ({
  gardeners,
}) => {
  return (
    <ul className="flex flex-col gap-2">
      {gardeners.length ?
        gardeners.map((user) => (
          <li key={user.id}>
            <img
              src={user.farcaster?.pfp ?? "/images/avatar.png"}
              alt="Profile"
            />
            <span>
              {user?.email?.address || user.phone?.number || "Unknown User"}
            </span>
          </li>
        ))
      : <p className="grid place-items-center p-8 text-center text-sm italic">
          No gardeners yet, get started by clicking a garden above
        </p>
      }
    </ul>
  );
};
