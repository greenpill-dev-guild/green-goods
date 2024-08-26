import React from "react";

import { Web3Props } from "../../hooks/providers/web3";
import { ProfileDataProps } from "../../hooks/useProfile";

import { ProfileInfo } from "../../components/Info";
import { ProfileActions } from "../../components/Profile/Actions";

interface ProfileProps extends ProfileDataProps, Web3Props {}

export const Profile: React.FC<ProfileProps> = ({
  avatarSpring,
  address,
  avatar,
  name,
  ready,
  user,
  wallets,
  activeWallet,
  sendTransaction,
  zeroDevReady,
  login,
  logout,
  error,
}) => {
  const web3Props = {
    address,
    login,
    logout,
    error,
    ready,
    zeroDevReady,
    user,
    activeWallet,
    wallets,
    sendTransaction,
  };

  return (
    <section className={`grid place-items-center h-full w-full gap-3 px-6`}>
      <div className={`relative w-full`}>
        <ProfileInfo
          avatar={
            avatar ||
            "data:image/jpeg;base64,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"
          }
          username={name || address}
          avatarSpring={avatarSpring}
        />
        <ProfileActions {...web3Props} />
      </div>
    </section>
  );
};

export default Profile;
