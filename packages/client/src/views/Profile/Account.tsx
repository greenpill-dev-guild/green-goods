import { usePrivy } from "@privy-io/react-auth";
import {
  RiKeyLine,
  RiMailFill,
  RiPhoneLine,
  RiWalletLine,
  RiLogoutBoxRLine,
} from "@remixicon/react";

import { Button } from "@/components/UI/Button";
import { Card } from "@/components/UI/Card/Card";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/UI/Avatar/Avatar";

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
    <div className="flex flex-col gap-4 my-4">
      <h5>Edit Account</h5>
      {linkedAccounts.map(
        ({ title, Icon, description, isLinked, link, unlink }) => (
          <Card key={title}>
            <div className="flex flex-row items-center gap-3">
              <Avatar>
                <div className="flex items-center justify-center text-center mx-auto text-greengoods-green">
                  {Icon}
                </div>
              </Avatar>
              <div className="flex flex-col gap-1">
                <div className="flex items-center font-sm gap-1">
                  <div className="line-clamp-1 text-sm">{title}</div>
                </div>
                <div className="text-xs text-gray-500">{description}</div>
              </div>
            </div>
            <Button
              label={isLinked ? "Unlink" : "Link"}
              onClick={isLinked ? unlink : link}
              variant="secondary"
              mode={isLinked ? "outline" : "filled"}
              size="small"
            />
          </Card>
        )
      )}
      <Button
        className="w-full mt-2"
        variant="danger"
        mode="outline"
        shadow="shadow"
        onClick={logout}
      >
        <div className="flex flex-row gap-2 items-center">
          Logout <RiLogoutBoxRLine className="w-4.5" />
        </div>
      </Button>
    </div>
  );
};
