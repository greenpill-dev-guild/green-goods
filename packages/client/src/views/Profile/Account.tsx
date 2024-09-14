import {
  RiKeyLine,
  RiMailFill,
  RiPhoneLine,
  RiUserLine,
} from "@remixicon/react";
import { usePrivy } from "@privy-io/react-auth";

import { Button } from "@/components/Button";

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
    unlinkFarcaster,
  } = usePrivy();

  const linkedAccounts: LinkedAccount[] = [
    {
      title: "Email",
      description: user?.email?.address || "Not Linked",
      isLinked: !!user?.email?.address,
      Icon: <RiMailFill className="w-4" />,
      link: linkEmail,
      unlink: () => user?.email?.address && unlinkEmail(user?.email?.address),
    },
    {
      title: "Phone",
      description: user?.phone?.number || "Not Linked",
      isLinked: !!user?.phone?.number,
      Icon: <RiPhoneLine className="w-4" />,
      link: linkPhone,
      unlink: () => user?.phone?.number && unlinkPhone(user?.phone?.number),
    },
    {
      title: "Passkey",
      description: user?.mfaMethods.includes("passkey") ? "" : "Not Linked",
      isLinked: !!user?.mfaMethods.includes("passkey"),
      Icon: <RiKeyLine className="w-4" />,
      link: linkPasskey,
      unlink: () => {},
    },
    {
      title: "Farcaster",
      description: user?.farcaster?.displayName || "Not Linked",
      isLinked: !!user?.farcaster?.displayName,
      Icon: <RiUserLine className="w-4" />,
      link: linkFarcaster,
      unlink: () =>
        user?.farcaster?.fid && unlinkFarcaster(user?.farcaster?.fid),
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-2 mt-4">
        <h5>Linked Accounts</h5>
        <ul className="flex flex-col gap-2">
          {linkedAccounts.map(
            ({ title, Icon, description, isLinked, link, unlink }) => (
              <li
                key={title}
                className="flex gap-1 justify-between border border-stone-50 shadow-sm "
              >
                <div className="flex flex-col gap-2 px-2 py-3">
                  <div className="flex items-center font-sm gap-1">
                    {Icon}
                    <label className="line-clamp-1 text-sm">{title}</label>
                  </div>
                  <p className="text-xs">{description}</p>
                </div>
                <Button
                  label={isLinked ? "Unlink" : "Link"}
                  onClick={isLinked ? unlink : link}
                  variant="secondary"
                  className="w-[20vw]"
                  size="small"
                />
              </li>
            )
          )}
        </ul>
      </div>
    </>
  );
};
