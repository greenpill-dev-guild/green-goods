import React from "react";
import zod from "zod";

import { Button } from "@/components/Button";
import { FormInput } from "@/components/Form/Input";

interface ProfileEditProps {
  login: () => void;
  isLoggingIn: boolean;
  buttonLabel: string;
}

const schema = zod.object<OnboardingFormValues>().shape({
  username: zod.string().required("Username is required").min(2).max(27),
  location: zod.string().max(50),
  email: zod.string().email("Please provide a recognized email"),
});

export const ProfileEdit: React.FC<ProfileEditProps> = ({
  login,
  isLoggingIn,
  buttonLabel,
}) => {
  return (
    <div className="flex flex-col items-center justify-center  gap-4 text-black w-full h-full">
      <img
        src="/icons/android-chrome-512x512.png"
        alt="Impact Vocie"
        width={100}
        height={100}
      />
      <FormInput
        // {...register("username")}
        label="Username"
        // error={errors.username && errors.username.message}
        placeholder={t("username")}
      />
      <FormInput
        // {...register("location")}
        label="Location"
        // error={errors.location && errors.location.message}
        placeholder={t("location")}
      />
      <FormInput
        // {...register("email")}
        label="Email"
        // error={errors.email && errors.email.message}
        placeholder={t("email")}
      />
      <Button
        label={buttonLabel}
        onClick={login}
        disabled={isLoggingIn}
        fullWidth
      />
    </div>
  );
};
