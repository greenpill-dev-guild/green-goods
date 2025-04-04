import {
  RiMailFill,
  RiPhoneFill,
  RiShieldCheckFill,
  RiTelegramLine,
  RiUserLocationFill,
  RiWallet3Fill,
  RiWhatsappLine,
} from "@remixicon/react";
import { Badge } from "../Badge/Badge";

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
} & actionsMap;

export const Profile: React.FC<ProfileProps> = ({
  avatar,
  displayName,
  ...props
}) => {
  return (
    <div className="relative flex flex-col items-center gap-2 px-2">
      <div className="relative w-24 aspect-square -z-10 mb-2" />
      <img
        src={avatar ?? "/images/avatar.png"}
        alt="profile avatar"
        className="rounded-full w-24 min-w-24 absolute"
      />
      <h5>{displayName}</h5>
      <div className="flex flex-row flex-wrap justify-center items-center">
        {Object.entries(props).map(([key, value]) => {
          const Icon = ProfileDataTypes[key as keyof typeof ProfileDataTypes];
          if (value === undefined) return;
          return (
            <Badge
              key={key}
              leadingIcon={<Icon className="w-4 text-primary mx-1" />}
            >
              {value}
            </Badge>
          );
        })}
      </div>
    </div>
  );
};
