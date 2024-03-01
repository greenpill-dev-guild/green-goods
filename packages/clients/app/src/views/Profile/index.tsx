import React from "react";

import { Web3Props } from "../../hooks/providers/web3";
import { ProfileDataProps } from "../../hooks/views/useProfile";

import { ProfileInfo } from "../../components/Profile/Info";
import { ProfileActions } from "../../components/Profile/Actions";

interface ProfileProps extends ProfileDataProps, Web3Props {}

export const Profile: React.FC<ProfileProps> = ({
  avatarSpring,
  address,
  name,
  login,
  logout,
  error,
}) => {
  const web3Props = {
    address,
    login,
    logout,
    error,
  };

  return (
    <section className={`grid place-items-center h-full w-full gap-3 px-6`}>
      <div className={`relative w-full`}>
        <ProfileInfo
          avatar={"/assets/avatar.png"}
          username={name || address}
          avatarSpring={avatarSpring}
        />
        <ProfileActions {...web3Props} />
      </div>
    </section>
  );
};

export default Profile;
