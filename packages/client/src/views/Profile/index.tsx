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
    <section className={"flex"}>
      <Tabs defaultValue="help" className="w-full h-full px-4 pt-72 pb-4">
        <div className="fixed flex flex-col gap-1 top-0 left-0 px-4 pt-8 bg-white z-10">
          <UserProfile
            displayName={
              user?.email?.address ||
              user?.phone?.number ||
              user?.id ||
              "Unknown"
            }
            avatar={user?.farcaster?.pfp || "/images/avatar.png"}
            location={(user?.customMetadata?.location as string) || undefined}
            wallet={
              user?.wallet?.address && formatAddress(user?.wallet?.address)
            }
            registration={user?.createdAt.toLocaleDateString() || undefined}
            email={user?.email?.address || undefined}
            telephone={user?.phone?.number || undefined}
          />
          <TabsList className="flex items-center justify-center mt-2">
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
