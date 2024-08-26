import { usePrivy } from "@privy-io/react-auth";
// import { SpringValue, useSpring } from "@react-spring/web";

export interface ProfileDataProps {
  name?: string | null;
  avatar?: string | null;
  // avatarSpring: {
  //   opacity: SpringValue<number>;
  //   transform: SpringValue<string>;
  // };
}

export const useProfile = (): ProfileDataProps => {
  const { user } = usePrivy();

  // const avatarSpring = useSpring({
  //   from: { opacity: 0, transform: "translate3d(0, -100%, 0)" },
  //   to: { opacity: 1, transform: "translate3d(0, 0%, 0)" },
  // });

  return {
    name: user?.email?.address,
    avatar: user?.farcaster?.pfp,
    // avatarSpring,
    // ...web3,
  };
};
