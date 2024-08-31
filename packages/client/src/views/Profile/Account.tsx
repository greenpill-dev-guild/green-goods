import {
  RiKeyLine,
  RiMailFill,
  RiPhoneLine,
  RiUserLine,
} from "@remixicon/react";
import { usePrivy } from "@privy-io/react-auth";

import { usePWA } from "@/providers/PWAProvider";
import { useUser } from "@/providers/UserProvider";

interface LinkedAccount {
  title: string;
  description: string;
  isLinked: boolean;
  Icon: React.ReactNode;
  link: () => void;
  unlink: () => void;
}

interface ProfileAccountProps {}

export const ProfileAccount: React.FC<ProfileAccountProps> = () => {
  const {
    user,
    linkEmail,
    linkPhone,
    linkPasskey,
    linkFarcaster,
    unlinkEmail,
    unlinkPhone,
    // unlinkPasskey,
    unlinkFarcaster,
  } = usePrivy();
  const { switchLanguage } = usePWA();
  const { logout } = useUser();

  const linkedAccounts: LinkedAccount[] = [
    {
      title: "Email",
      description: user?.email?.address || "Not Linked",
      isLinked: !!user?.email?.address,
      Icon: <RiMailFill />,
      link: linkEmail,
      unlink: () => user?.email?.address && unlinkEmail(user?.email?.address),
    },
    {
      title: "Phone",
      description: user?.phone?.number || "Not Linked",
      isLinked: !!user?.phone?.number,
      Icon: <RiPhoneLine />,
      link: linkPhone,
      unlink: () => user?.phone?.number && unlinkPhone(user?.phone?.number),
    },
    {
      title: "Passkey",
      description: user?.mfaMethods.includes("passkey") ? "" : "Not Linked",
      isLinked: !!user?.mfaMethods.includes("passkey"),
      Icon: <RiKeyLine />,
      link: linkPasskey,
      unlink: () => {},
    },
    {
      title: "Farcaster",
      description: user?.farcaster?.displayName || "Not Linked",
      isLinked: !!user?.farcaster?.displayName,
      Icon: <RiUserLine />,
      link: linkFarcaster,
      unlink: () =>
        user?.farcaster?.fid && unlinkFarcaster(user?.farcaster?.fid),
    },
  ];

  return (
    <div className="flex flex-col gap-3 items-center w-full">
      <h3>Languages</h3>
      <button onClick={() => switchLanguage("en")}>English</button>
      <button onClick={() => switchLanguage("pt")}>Português</button>
      <h3>Linked Accounts</h3>
      <ul>
        {linkedAccounts.map(
          ({ title, Icon, description, isLinked, link, unlink }) => (
            <li key={title} className="flex gap-1">
              <span>{Icon}</span>
              <span>{title}</span>
              <span>{description}</span>
              <button onClick={isLinked ? unlink : link}>
                {isLinked ? "Unlink" : "Link"}
              </button>
            </li>
          )
        )}
      </ul>
      <h3>Settings</h3>
      <button onClick={logout}>Logout</button>
    </div>
  );
};
