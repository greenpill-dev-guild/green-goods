import { useLogout } from "@privy-io/react-auth";

import { Button } from "@/components/Button";

interface ProfileSettingsProps {}

export const ProfileSettings: React.FC<ProfileSettingsProps> = () => {
  const { logout } = useLogout();

  return (
    <>
      {/* <div className="mt-4 mb-20 flex flex-col gap-4">
        <h5 className="">Notificatioins</h5>
        <div className="flex divide-x-2 border border-slate-50 bg-slate-100 rounded-xl overflow-hidden text-black">
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
      </div> */}
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
