import React, { useState } from "react";

import { useUser } from "@/providers/UserProvider";

import { ProfileHelp } from "./Help";
import { ProfileAccount } from "./Account";
import { ProfileSettings } from "./Settings";

interface ProfileProps {}

enum ProfileTabs {
  Account = "account",
  Settings = "settings",
  Help = "help",
}

const Profile: React.FC<ProfileProps> = () => {
  const {} = useUser();
  const [activeTab, setActiveTab] = useState<ProfileTabs>(ProfileTabs.Account);

  const renderTabContent = () => {
    switch (activeTab) {
      case ProfileTabs.Account:
        return <ProfileAccount />;
      case ProfileTabs.Settings:
        return <ProfileSettings />;
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
          src={"/images/avatar.png"}
          alt="profile avatar"
          className="rounded-full w-20"
        />
      </div>
      <div>
        <ul>
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
