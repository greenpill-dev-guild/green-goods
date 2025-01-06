import { usePWA } from "@/providers/pwa";
import { useUser } from "@/providers/user";

import { Button } from "@/components/Button";

interface ProfileSettingsProps {}

export const ProfileSettings: React.FC<ProfileSettingsProps> = () => {
  const { switchLanguage, locale } = usePWA();
  const { logout } = useUser();

  console.log("locale", locale);

  return (
    <>
      <div className="mt-4 mb-20 flex flex-col gap-4">
        <h5 className="">Languages</h5>
        <div className="flex divide-x-2 border border-stone-50 bg-stone-100 rounded-xl overflow-hidden text-black">
          <label
            onClick={() => switchLanguage("en")}
            className={`flex-1 flex items-center justify-center gap-1 p-3 transition-colors duration-300 ease-in-out ${locale === "en" ? "bg-stone-200" : ""}`}
          >
            English
          </label>
          <label
            onClick={() => switchLanguage("pt")}
            className={`flex-1 flex items-center justify-center gap-1 p-3 transition-colors duration-300 ease-in-out ${locale === "pt" ? "bg-stone-200" : ""}`}
          >
            Português
          </label>
        </div>
      </div>
      <div className="mt-4 mb-20 flex flex-col gap-4">
        <h5 className="">Notificatioins</h5>
        <div className="flex divide-x-2 border border-stone-50 bg-stone-100 rounded-xl overflow-hidden text-black">
          <div className="flex gap-4 justify-between">
            <label>Email Notifications</label>
            <input
              type="checkbox"
              className="toggle toggle-lg"
              defaultChecked
            />
          </div>
          <div className="flex gap-4 justify-between">
            <label>Push Notifications</label>
            <input
              type="checkbox"
              className="toggle toggle-lg"
              defaultChecked
            />
          </div>
        </div>
      </div>
      <Button
        label="Logout"
        className="bg-red-500"
        fullWidth
        // size="small"
        onClick={logout}
      />
    </>
  );
};
