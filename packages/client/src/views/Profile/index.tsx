import type React from "react";
import { RiHeadphoneLine, RiSettings2Fill } from "@remixicon/react";
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
  account: { value: "account", Icon: RiSettings2Fill, label: "Account" },
};

const Profile: React.FC = () => {
  const { user } = useUser();

  return (
    <section className={"padded flex flex-col h-full py-4 pb-10 gap-6 pt-8"}>
      <UserProfile
        displayName={
          user?.email?.address || user?.phone?.number || user?.id || "Unknown"
        }
        avatar={user?.farcaster?.pfp || "/images/avatar.png"}
        location={(user?.customMetadata?.location as string) || undefined}
        wallet={user?.wallet?.address && formatAddress(user?.wallet?.address)}
        registration={user?.createdAt.toLocaleDateString() || undefined}
        email={user?.email?.address || undefined}
        telephone={user?.phone?.number || undefined}
      />
      <Tabs defaultValue="help" className="">
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
    </section>
  );
};

export default Profile;
