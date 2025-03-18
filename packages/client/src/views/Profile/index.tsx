import type React from "react";
import {
  RiHeadphoneLine,
  RiSettings2Fill,
} from "@remixicon/react";
import { Profile as UserProfile } from "@/components/UI/Profile/Profile";

import { formatAddress } from "@/utils/text";

import { useUser } from "@/providers/user";

import { ProfileHelp } from "./Help";
import { ProfileAccount } from "./Account";
import {
  Tabs,
  TabsTrigger,
  TabsContent,
  TabsList,
} from "@/components/UI/Tabs/Tabs";

const availableTabs = {
  help: { value: "help", Icon: RiHeadphoneLine, label: "Help" },
  account: { value: "account", Icon: RiSettings2Fill, label: "Settings" },
};

const Profile: React.FC = () => {
  const { user } = useUser();

  console.log(user);
  return (
    <div className={"flex flex-col h-full py-4 pb-10 gap-4"}>
      <UserProfile
        displayName={user?.email?.address || user?.phone?.number || "Bubba"}
        avatar={user?.farcaster?.pfp || "/images/avatar.png"}
        location="downtown"
        wallet={formatAddress(user?.wallet?.address || "0x0")}
        registration="2022-01-01"
        email="bubba@bubba.com"
        telephone="123456789"
      />
      <Tabs defaultValue="account">
        <div className="flex items-center justify-center">
          <TabsList className="">
            {Object.values(availableTabs).map((tab) => {
              const Icon = tab.Icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  variant="gardenTabs"
                >
                  {<Icon className="w-4 mx-1" />}
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
        <TabsContent value="account">
          <ProfileAccount />
        </TabsContent>
        <TabsContent value="help">
          <ProfileHelp />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Profile;
