import { usePWA } from "@/providers/PWAProvider";
// import { SpringValue, a } from "@react-spring/web";

interface ProfileInfoProps {
  username?: string | null;
  avatar?: string;
  // avatarSpring: {
  //   opacity: SpringValue<number>;
  //   transform: SpringValue<string>;
  // };
}

export const ProfileInfo: React.FC<ProfileInfoProps> = ({
  avatar,
  // avatarSpring,
  username,
}) => {
  const { switchLanguage } = usePWA();
  return (
    <div
      className="absolute bottom-[100%] left-0 rigt-0 flex flex-col gap-3 items-center w-full"
      // style={avatarSpring}
    >
      <div className="text-neutral-content rounded-full w-20">
        <img src={avatar} alt="profile avatar" className="rounded-full w-20" />
      </div>
      <button onClick={() => switchLanguage("en")}>English</button>
      <button onClick={() => switchLanguage("pt")}>Português</button>
      {/* Rest of your app goes here */}
      <h5 className="w-2/3 h-12 line-clamp-1 capitalize">{username}</h5>
    </div>
  );
};
