import {
  RiMailFill,
  RiPhoneFill,
  RiShieldCheckFill,
  RiTelegramLine,
  RiUserLocationFill,
  RiWallet3Fill,
  RiWhatsappLine,
} from "@remixicon/react";
import { Badge } from "@/components/Communication";

const ProfileDataTypes = {
  location: RiUserLocationFill,
  registration: RiShieldCheckFill,
  wallet: RiWallet3Fill,
  telephone: RiPhoneFill,
  email: RiMailFill,
  telegram: RiTelegramLine,
  whatsapp: RiWhatsappLine,
} as const;

type actionsMap = {
  [K in keyof typeof ProfileDataTypes]?: string;
};

type ProfileProps = {
  avatar: string;
  displayName: string;
  isLoadingAvatar?: boolean;
} & actionsMap;

export const Profile: React.FC<ProfileProps> = ({
  avatar,
  displayName,
  isLoadingAvatar,
  ...props
}) => {
  return (
    <div className="relative flex flex-col items-center gap-2 px-2">
      {/* Avatar container with proper spacing */}
      <div className="relative w-24 h-24 mb-2">
        <img
          src={avatar ?? "/images/avatar.png"}
          alt="profile avatar"
          className="rounded-full w-24 h-24 object-cover"
        />
        {isLoadingAvatar && (
          <div className="absolute inset-0 rounded-full bg-bg-soft-200/80 animate-pulse backdrop-blur-sm" />
        )}
      </div>
      <h5 className="font-semibold text-lg">{displayName}</h5>
      <div className="flex flex-row flex-wrap justify-center items-center gap-2">
        {Object.entries(props).map(([key, value]) => {
          const Icon = ProfileDataTypes[key as keyof typeof ProfileDataTypes];
          if (value === undefined) return;
          return (
            <Badge key={key} leadingIcon={<Icon className="w-4 text-primary mx-1" />}>
              {value}
            </Badge>
          );
        })}
      </div>
    </div>
  );
};
