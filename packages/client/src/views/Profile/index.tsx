import { RiHeadphoneLine, RiSettings2Fill } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { Profile as UserProfile } from "@/components/UI/Profile/Profile";
import { type StandardTab, StandardTabs } from "@/components/UI/Tabs";
import { useUser } from "@/hooks/auth/useUser";
import { formatAddress } from "@/utils/app/text";
import { ProfileAccount } from "./Account";
import { ProfileHelp } from "./Help";

const Profile: React.FC = () => {
  const { smartAccountAddress, eoa } = useUser();
  const intl = useIntl();
  const [activeTab, setActiveTab] = useState("account");

  // Primary address is smart account (if available) or EOA
  const primaryAddress = smartAccountAddress || eoa?.address;
  const displayName = primaryAddress ? formatAddress(primaryAddress) : "Unknown";

  const tabs: StandardTab[] = [
    {
      id: "account",
      label: intl.formatMessage({
        id: "app.profile.account",
        description: "Account",
      }),
      icon: <RiSettings2Fill className="w-4" />,
    },
    {
      id: "help",
      label: intl.formatMessage({
        id: "app.profile.help",
        description: "Help",
      }),
      icon: <RiHeadphoneLine className="w-4" />,
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "account":
        return <ProfileAccount />;
      case "help":
        return <ProfileHelp />;
      default:
        return <ProfileAccount />;
    }
  };

  return (
    <section className="flex flex-col h-full">
      {/* Fixed Header */}
      <div className="fixed w-full top-0 left-0 bg-white z-10">
        <div className="px-4 pt-6 pb-4">
          <UserProfile
            displayName={displayName}
            avatar="/images/avatar.png"
            wallet={primaryAddress ? formatAddress(primaryAddress) : undefined}
          />
        </div>

        {/* Full Screen Tabs - outside padding */}
        <StandardTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          variant="compact"
          scrollTargetSelector="#profile-scroll"
        />
      </div>

      {/* Content */}
      <div id="profile-scroll" className="flex-1 pt-64 pb-4 overflow-y-auto">
        <div className="padded flex flex-col gap-4 my-4">{renderTabContent()}</div>
      </div>
    </section>
  );
};

export default Profile;
