import { Gardener } from "@/providers/GardenProvider";

interface GardenGardenersProps {
  gardeners: Gardener[];
}

export const GardenGardeners: React.FC<GardenGardenersProps> = ({
  gardeners,
}) => {
  return (
    <ul className="flex flex-col gap-2">
      {gardeners.map((user) => (
        <li key={user.id}>
          <img
            src={user.farcaster?.pfp ?? "/images/avatar.png"}
            alt="Profile"
          />
          <span>
            {user?.email?.address || user.phone?.number || "Unknown User"}
          </span>
        </li>
      ))}
    </ul>
  );
};
