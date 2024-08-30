import { usePrivy } from "@privy-io/react-auth";

export interface ProfileDataProps {
  name?: string | null;
  avatar?: string | null;
}

export const useProfile = (): ProfileDataProps => {
  const { user } = usePrivy();

  return {
    name: user?.email?.address,
    avatar: user?.farcaster?.pfp,
    // avatarSpring,
    // ...web3,
  };
};
