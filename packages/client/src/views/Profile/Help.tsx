// import { Button } from "@/components/Button";

interface ProfileHelpProps {}

export const ProfileHelp: React.FC<ProfileHelpProps> = (
  {
    // error,
    // address,
    // logout,
    // login,
  }
) => {
  return (
    <div className="flex flex-col gap-3 items-center w-full">
      {/* <Button
        title={address ? "Disconnect" : "Connect"}
        onClick={address ? logout : login}
      /> */}
      {/* <p className="text-red-500 h-10 line-clamp-2">{error}</p> */}
    </div>
  );
};
