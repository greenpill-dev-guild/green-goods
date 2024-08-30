import { usePWA } from "@/providers/PWAProvider";
import { useUser } from "@/providers/UserProvider";
// import { SpringValue, a } from "@react-spring/web";

interface ProfileSettingsProps {
  // avatarSpring: {
  //   opacity: SpringValue<number>;
  //   transform: SpringValue<string>;
  // };
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = (
  {
    // avatar,
    // avatarSpring,
    // username,
  }
) => {
  const { logout } = useUser();
  const { switchLanguage } = usePWA();

  return (
    <div
      className="absolute bottom-[100%] left-0 rigt-0 flex flex-col gap-3 items-center w-full"
      // style={avatarSpring}
    >
      <button onClick={() => switchLanguage("en")}>English</button>
      <button onClick={() => switchLanguage("pt")}>Português</button>
      <button onClick={logout}>Logout</button>
      {/* <h5 className="w-2/3 h-12 line-clamp-1 capitalize">{username}</h5> */}
    </div>
  );
};
