import { SpringValue, useSpring } from "@react-spring/web";

import { Web3Props, useWeb3 } from "../providers/web3";

export interface ProfileDataProps extends Web3Props {
  name?: string | null;
  avatar?: string | null;
  avatarSpring: {
    opacity: SpringValue<number>;
    transform: SpringValue<string>;
  };
}

export const useProfile = (): ProfileDataProps => {
  const web3 = useWeb3();

  const avatarSpring = useSpring({
    from: { opacity: 0, transform: "translate3d(0, -100%, 0)" },
    to: { opacity: 1, transform: "translate3d(0, 0%, 0)" },
  });

  return {
    name: web3.user?.name,
    avatar: web3.user?.avatar,
    avatarSpring,
    ...web3,
  };
};
