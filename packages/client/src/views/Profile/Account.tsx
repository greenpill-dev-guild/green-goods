import { usePrivy } from "@privy-io/react-auth";
import {
  RiKeyLine,
  RiMailFill,
  RiPhoneLine,
  RiWalletLine,
} from "@remixicon/react";

import { Button } from "@/components/UI/Button";

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
    linkWallet,
    unlinkEmail,
    unlinkPhone,
    // unlinkPasskey,
    unlinkWallet,
    logout,
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
      title: "Wallet",
      description: user?.wallet ? "" : "Not Linked",
      isLinked: !!user?.wallet,
      Icon: <RiWalletLine className="w-4" />,
      link: linkWallet,
      unlink: () =>
        user?.wallet?.address && unlinkWallet(user?.wallet?.address),
    },
  ];

  return (
    <div className="flex flex-col gap-2 mt-4">
      <h5>Linked Accounts</h5>
        {linkedAccounts.map(
          ({ title, Icon, description, isLinked, link, unlink }) => (
            <div
              key={title}
              className="flex gap-1 justify-between border-2 border-slate-100 shadow-2xs "
            >
              <div className="flex flex-col gap-2 px-2 py-1">
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
                className="w-[20vw] bg-teal-400"
                size="small"
              />
            </div>
          )
        )}
      <Button label="Logout" variant="danger" size="small" onClick={logout} />
    </div>
  );
};
