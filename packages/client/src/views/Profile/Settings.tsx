import { usePWA } from "@/providers/PWAProvider";
import { useUser } from "@/providers/UserProvider";

interface ProfileSettingsProps {}

export const ProfileSettings: React.FC<ProfileSettingsProps> = () => {
  const { logout } = useUser();
  const { switchLanguage } = usePWA();

  return (
    <div className="absolute bottom-[100%] left-0 rigt-0 flex flex-col gap-3 items-center w-full">
      <button onClick={() => switchLanguage("en")}>English</button>
      <button onClick={() => switchLanguage("pt")}>Português</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};
