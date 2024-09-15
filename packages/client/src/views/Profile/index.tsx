import React, { useState } from "react";

import { formatAddress } from "@/utils/text";

import { useUser } from "@/providers/UserProvider";

import { ProfileHelp } from "./Help";
import { ProfileAccount } from "./Account";
import { ProfileSettings } from "./Setting";
import { RiWalletFill } from "@remixicon/react";

interface ProfileProps {}

enum ProfileTabs {
  Account = "account",
  Help = "help",
  Settings = "settings",
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
      case ProfileTabs.Settings:
        return <ProfileSettings />;
      default:
        return null;
    }
  };

  return (
    <div className={`flex flex-col h-full w-full pt-8`}>
      <div className="flex flex-col items-center gap-1 px-2 mb-6">
        <img
          src={user?.farcaster?.pfp ?? "/images/avatar.png"}
          alt="profile avatar"
          className="rounded-full w-36"
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
      <ul className="flex items-center flex-nowrap border border-stone-100 shadow-sm rounded-lg divide-x-2">
        {Object.values(ProfileTabs).map((tab) => (
          <li
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 flex justify-center items-center p-3 cursor-pointer ${tab === activeTab ? "bg-stone-100" : ""} transition-colors duration-200`}
          >
            <label className="capitalize small font-semibold text-center w-full">
              {tab}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex-1 overflow-y-scroll flex flex-col gap-2 pb-16">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default Profile;
