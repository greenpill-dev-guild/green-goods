import React from "react";

// import { ProfileDataProps } from "./useProfile";

import { ProfileHelp } from "./Help";
import { ProfileAccount } from "./Account";
import { ProfileSettings } from "./Settings";

interface ProfileProps {}

type ProfileTab = "account" | "settings" | "help";

const Profile: React.FC<ProfileProps> = (
  {
    // avatarSpring,
    // avatar,
    // name,
  }
) => {
  const [tab, setTab] = React.useState<ProfileTab>("account");

  return (
    <div className={`grid place-items-center h-full w-full gap-3 px-6`}>
      <div className="text-neutral-content rounded-full w-20">
        <img
          src={"/images/avatar.png"}
          alt="profile avatar"
          className="rounded-full w-20"
        />
      </div>
      {/* <Tabs /> */}
      <div className="flex gap-3">
        <button
          onClick={() => setTab("account")}
          className={`${
            tab === "account" ? "bg-neutral-content text-neutral" : "bg-neutral"
          } px-3 py-2 rounded-md`}
        >
          Account
        </button>
        <button
          onClick={() => setTab("settings")}
          className={`${
            tab === "settings" ?
              "bg-neutral-content text-neutral"
            : "bg-neutral"
          } px-3 py-2 rounded-md`}
        >
          Settings
        </button>
        <button
          onClick={() => setTab("help")}
          className={`${
            tab === "help" ? "bg-neutral-content text-neutral" : "bg-neutral"
          } px-3 py-2 rounded-md`}
        >
          Help
        </button>
      </div>
      {/* <View/> */}
      <div>
        {tab === "account" && <ProfileAccount />}
        {tab === "settings" && <ProfileSettings />}
        {tab === "help" && <ProfileHelp />}
      </div>
    </div>
  );
};

export default Profile;
