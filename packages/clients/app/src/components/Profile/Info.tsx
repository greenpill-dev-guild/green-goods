import { SpringValue, a } from "@react-spring/web";

interface ProfileInfoProps {
  username?: string;
  avatar?: string;
  avatarSpring: {
    opacity: SpringValue<number>;
    transform: SpringValue<string>;
  };
}

export const ProfileInfo: React.FC<ProfileInfoProps> = ({
  avatar,
  avatarSpring,
  username,
}) => {
  return (
    <a.div
      className="absolute bottom-[100%] left-0 rigt-0 flex flex-col gap-3 items-center w-full"
      style={avatarSpring}
    >
      <div className="text-neutral-content rounded-full w-20">
        <img src={avatar} alt="profile avatar" className="" />
      </div>
      <h5 className="w-2/3 h-12 line-clamp-1 capitalize">{username}</h5>
    </a.div>
  );
};
