import { useAuth, useEnsAvatar, useGardenerProfile, useUser } from "@green-goods/shared/hooks";
import { resolveAvatarUrl } from "@green-goods/shared/modules";
import { formatAddress } from "@green-goods/shared/utils";
import { RiHeadphoneLine, RiSettings2Fill } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { Profile as UserProfile } from "@/components/Features";
import { type StandardTab, StandardTabs } from "@/components/Navigation";
import { ProfileAccount } from "./Account";
import { ProfileHelp } from "./Help";

const DEFAULT_AVATAR = "/images/avatar.png";

const Profile: React.FC = () => {
  const { user, ensName } = useUser();
  const { userName } = useAuth();
  const { profile } = useGardenerProfile();
  const intl = useIntl();
  const [activeTab, setActiveTab] = useState<"account" | "help">("account");

  const primaryAddress = user?.id;
  const formattedAddress = primaryAddress ? formatAddress(primaryAddress, { ensName }) : null;

  const { data: ensAvatar, isLoading: isLoadingAvatar } = useEnsAvatar(primaryAddress ?? undefined);

  const fallbackDisplayName = intl.formatMessage({
    id: "app.garden.gardeners.unknownUser",
    defaultMessage: "Unknown User",
  });

  // Display name priority: profile name > ENS > passkey username > formatted address > fallback
  const displayName =
    profile?.name?.trim() || ensName || userName || formattedAddress || fallbackDisplayName;

  const headerAvatar = profile?.imageURI
    ? resolveAvatarUrl(profile.imageURI)
    : ensAvatar || DEFAULT_AVATAR;

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

  return (
    <section className="flex h-full flex-col">
      {/* Fixed Header */}
      <div className="fixed left-0 top-0 z-10 w-full bg-bg-white-0">
        <div className="px-4 pt-6 pb-4">
          <UserProfile
            displayName={displayName}
            avatar={headerAvatar}
            isLoadingAvatar={isLoadingAvatar && !profile?.imageURI}
            location={profile?.location?.trim() || undefined}
          />
        </div>

        {/* Full Screen Tabs - outside padding */}
        <StandardTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as "account" | "help")}
          variant="compact"
          scrollTargetSelector="#profile-scroll"
        />
      </div>

      {/* Content */}
      <div id="profile-scroll" className="flex-1 overflow-x-hidden overflow-y-auto pt-64 pb-4">
        <div className="padded my-4 flex flex-col gap-4">
          {activeTab === "help" ? <ProfileHelp /> : <ProfileAccount />}
        </div>
      </div>
    </section>
  );
};

export default Profile;
