import type React from "react";
import { useState } from "react";
import { RiWalletFill } from "@remixicon/react";

import { formatAddress } from "@/utils/text";

import { useUser } from "@/providers/user";

import { ProfileHelp } from "./Help";
import { ProfileAccount } from "./Account";
// import { ProfileSettings } from "./Setting";

interface ProfileProps {}

enum ProfileTabs {
  Account = "account",
  Help = "help",
  // Settings = "settings",
}

const Profile: React.FC<ProfileProps> = () => {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<ProfileTabs>(ProfileTabs.Account);

  const renderTabContent = () => {
    switch (activeTab) {
      case ProfileTabs.Account:
        return <ProfileAccount />;
      case ProfileTabs.Help:
        return <ProfileHelp />;
      // case ProfileTabs.Settings:
      //   return <ProfileSettings />;
      default:
        return null;
    }
  };

  return (
    <div className={"flex flex-col w-full pt-8 mx-auto"}>
      <div className="flex flex-col items-center gap-2 px-2 mb-6">
        <div className="relative w-36 aspect-square -z-10"/>  
        <img
          src={user?.farcaster?.pfp ?? "/images/avatar.png"}
          alt="profile avatar"
          className="rounded-full w-36 min-w-36 absolute"
        />
        <h4 className="font-semibold line-clamp-1">
          {user?.email?.address || user?.phone?.number}
        </h4>
        {user?.wallet?.address && (
          <label className="text-xl flex gap-1">
            <RiWalletFill />
            {formatAddress(user?.wallet?.address)}
          </label>
        )}
      </div>
        {Object.values(ProfileTabs).map((tab) => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 flex justify-center items-center p-3 cursor-pointer ${tab === activeTab ? "bg-teal-100" : ""} transition-colors duration-200`}
          >
            <label className="capitalize small font-semibold text-center w-full">
              {tab}
            </label>
          </div>
        ))}
        {renderTabContent()}
    </div>
  );
};

export default Profile;
