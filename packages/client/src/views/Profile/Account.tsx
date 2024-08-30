// import { SpringValue, a } from "@react-spring/web";

interface ProfileAccountProps {
  username?: string | null;
  avatar?: string;
}

export const ProfileAccount: React.FC<ProfileAccountProps> = ({
  avatar,
  username,
}) => {
  return (
    <div className="absolute bottom-[100%] left-0 rigt-0 flex flex-col gap-3 items-center w-full">
      <div className="text-neutral-content rounded-full w-20">
        <img src={avatar} alt="profile avatar" className="rounded-full w-20" />
      </div>

      {/* Rest of your app goes here */}
      <h5 className="w-2/3 h-12 line-clamp-1 capitalize">{username}</h5>
    </div>
  );
};
