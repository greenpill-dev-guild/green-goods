import type React from "react";
import { RiHeadphoneLine, RiSettings2Fill } from "@remixicon/react";
import { Profile as UserProfile } from "@/components/UI/Profile/Profile";

import { formatAddress } from "@/utils/text";

import { useUser } from "@/providers/user";

import { ProfileHelp } from "./Help";
import { ProfileAccount } from "./Account";
import { Tabs, TabsTrigger, TabsContent, TabsList } from "@/components/UI/Tabs/Tabs";
import { useRef } from "react";
import { useIntl } from "react-intl";

const Profile: React.FC = () => {
  const { user } = useUser();
  const contentRef = useRef<HTMLDivElement>(null);
  const intl = useIntl();
  const availableTabs = {
    account: {
      value: "account",
      Icon: RiSettings2Fill,
      label: intl.formatMessage({
        id: "app.profile.account",
        description: "Account",
      }),
    },
    help: {
      value: "help",
      Icon: RiHeadphoneLine,
      label: intl.formatMessage({
        id: "app.profile.help",
        description: "Help",
      }),
    },
  };

  return (
    <section className={"flex"}>
      <Tabs
        defaultValue="account"
        className="w-full h-full px-4 pt-72 pb-4"
        onValueChange={() => {
          if (contentRef.current) {
            contentRef.current.scrollTop = 0;
          }
        }}
      >
        <div className="fixed w-full gap-1 top-0 left-0 px-4 py-8 bg-white z-10 items-center">
          <UserProfile
            displayName={user?.email?.address || user?.phone?.number || user?.id || "Unknown"}
            avatar={user?.farcaster?.pfp || "/images/avatar.png"}
            location={(user?.customMetadata?.location as string) || undefined}
            wallet={user?.wallet?.address && formatAddress(user?.wallet?.address)}
            registration={user?.createdAt.toLocaleDateString() || undefined}
            email={user?.email?.address || undefined}
            telephone={user?.phone?.number || undefined}
          />
          <TabsList className="flex items-center justify-center mt-2">
            {Object.values(availableTabs).map((tab) => {
              const Icon = tab.Icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value} variant="gardenTabs">
                  {<Icon className="w-4 mx-1" />}
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
        {/* <div className="flex flex-col gap-4 my-4"> */}
        <TabsContent className="flex flex-col gap-4 my-4" value="account" ref={contentRef}>
          <ProfileAccount />
        </TabsContent>
        <TabsContent className="flex flex-col gap-4 my-4" value="help" ref={contentRef}>
          <ProfileHelp />
        </TabsContent>
      </Tabs>
    </section>
  );
};

export default Profile;
