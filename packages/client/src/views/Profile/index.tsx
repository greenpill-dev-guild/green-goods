import React, { useState } from "react";

import { formatAddress } from "@/utils/text";

import { useUser } from "@/providers/UserProvider";

import { ProfileHelp } from "./Help";
import { ProfileAccount } from "./Account";

interface ProfileProps {}

enum ProfileTabs {
  Account = "account",
  Help = "help",
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
      default:
        return null;
    }
  };

  return (
    <div className={`grid place-items-center h-full w-full gap-3 px-6`}>
      <div className="text-neutral-content rounded-full w-20">
        <img
          src={user?.farcaster?.pfp ?? "/images/avatar.png"}
          alt="profile avatar"
          className="rounded-full w-20"
        />
        <h2>{user?.email?.address || user?.phone?.number}</h2>
        {user?.wallet?.address && (
          <label>{formatAddress(user?.wallet?.address)}</label>
        )}
      </div>
      <div>
        <ul className="flex gap-3">
          {Object.values(ProfileTabs).map((activeTab) => (
            <li
              key={activeTab}
              onClick={() => setActiveTab(activeTab)}
              style={{
                fontWeight: activeTab === activeTab ? "bold" : "normal",
                cursor: "pointer",
              }}
            >
              {activeTab}
            </li>
          ))}
        </ul>
        {renderTabContent()}
      </div>
    </div>
  );
};

export default Profile;
