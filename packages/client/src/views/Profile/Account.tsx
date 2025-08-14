import { usePrivy } from "@privy-io/react-auth";
import {
  RiEarthFill,
  RiKeyLine,
  RiLogoutBoxRLine,
  RiMailFill,
  RiPhoneLine,
  RiWalletLine,
} from "@remixicon/react";
import { ReactNode, useState } from "react";
import { useIntl } from "react-intl";
import { Avatar } from "@/components/UI/Avatar/Avatar";
import { Button } from "@/components/UI/Button";
import { Card } from "@/components/UI/Card/Card";
import { FormInput } from "@/components/UI/Form/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/UI/Select/Select";

import { type Locale, useApp } from "@/providers/app";
import { capitalize } from "@/utils/text";
import toast from "react-hot-toast";

interface LinkedAccount {
  title: string;
  description: string;
  isLinked: boolean;
  Icon: React.ReactNode;
  link: () => void;
  unlink: () => void;
}

interface ApplicationSettings {
  title: string;
  description: string;
  Option: () => ReactNode;
  Icon: React.ReactNode;
}

type ProfileAccountProps = {};

export const ProfileAccount: React.FC<ProfileAccountProps> = () => {
  const {
    user,
    linkEmail,
    linkPhone,
    linkPasskey,
    linkWallet,
    unlinkEmail,
    unlinkPhone,
    // unlinkPasskey,
    unlinkWallet,
    logout,
  } = usePrivy();

  const { locale, switchLanguage, availableLocales } = useApp();
  const intl = useIntl();
  const [displayName, setDisplayName] = useState<string>(
    ((user?.customMetadata?.username as string) || "") ?? ""
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!user?.id) return;
    try {
      setSaving(true);
      const { updateUserProfile } = await import("@/modules/greengoods");
      let accessToken: string | undefined;
      try {
        const maybeTokenGetter = (usePrivy() as any)?.getAccessToken;
        if (typeof maybeTokenGetter === "function") {
          accessToken = (await maybeTokenGetter()) as string | undefined;
        }
      } catch {}
      await updateUserProfile(user.id, { username: displayName }, accessToken);
      toast.success(
        intl.formatMessage({ id: "app.toast.profileUpdated", defaultMessage: "Profile updated" })
      );
    } catch (e) {
      toast.error(
        intl.formatMessage({ id: "app.toast.profileUpdateFailed", defaultMessage: "Update failed" })
      );
    } finally {
      setSaving(false);
    }
  }

  const applicationSettings: ApplicationSettings[] = [
    {
      title: intl.formatMessage({
        id: "app.settings.language",
        description: "Language",
      }),
      description: intl.formatMessage(
        {
          id: "app.settings.selectLanguage",
          description: "Select your desired language, language selector",
          defaultMessage: "Select your preferred language",
        },
        {
          language: locale,
        }
      ),
      Icon: <RiEarthFill className="w-4" />,
      Option: () => (
        <Select onValueChange={(val) => switchLanguage(val as Locale)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue
              className="capitalize"
              placeholder={capitalize(intl.formatDisplayName(locale, { type: "language" }) || "")}
            />
          </SelectTrigger>
          <SelectContent>
            {availableLocales?.map((localeOption) => (
              <SelectItem value={localeOption} key={localeOption} className="capitalize">
                {capitalize(intl.formatDisplayName(localeOption, { type: "language" }) || "")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
  ];

  const accountSettings: LinkedAccount[] = [
    {
      title: intl.formatMessage({
        id: "app.account.email",
        description: "Email",
      }),
      description:
        user?.email?.address ||
        intl.formatMessage({
          id: "app.account.notLinked",
          description: "Not Linked",
        }),
      isLinked: !!user?.email?.address,
      Icon: <RiMailFill className="w-4" />,
      link: linkEmail,
      unlink: () => user?.email?.address && unlinkEmail(user?.email?.address),
    },
    {
      title: intl.formatMessage({
        id: "app.account.phone",
        description: "Phone",
      }),
      description:
        user?.phone?.number ||
        intl.formatMessage({
          id: "app.account.notLinked",
          description: "Not Linked",
        }),
      isLinked: !!user?.phone?.number,
      Icon: <RiPhoneLine className="w-4" />,
      link: linkPhone,
      unlink: () => user?.phone?.number && unlinkPhone(user?.phone?.number),
    },
    {
      title: intl.formatMessage({
        id: "app.account.passkey",
        description: "Passkey",
      }),
      description: user?.mfaMethods.includes("passkey")
        ? ""
        : intl.formatMessage({
            id: "app.account.notLinked",
            description: "Not Linked",
          }),
      isLinked: !!user?.mfaMethods.includes("passkey"),
      Icon: <RiKeyLine className="w-4" />,
      link: linkPasskey,
      unlink: () => {},
    },
    {
      title: intl.formatMessage({
        id: "app.account.wallet",
        description: "Wallet",
      }),
      description: user?.wallet
        ? ""
        : intl.formatMessage({
            id: "app.account.notLinked",
            description: "Not Linked",
          }),
      isLinked: !!user?.wallet,
      Icon: <RiWalletLine className="w-4" />,
      link: linkWallet,
      unlink: () => user?.wallet?.address && unlinkWallet(user?.wallet?.address),
    },
  ];

  return (
    <>
      <h5>
        {intl.formatMessage({
          id: "app.profile.settings",
          description: "Settings",
        })}
      </h5>
      {applicationSettings.map(({ title, Icon, description, Option }) => (
        <Card key={title}>
          <div className="flex flex-row items-center gap-3 justify-center w-full">
            <Avatar>
              <div className="flex items-center justify-center text-center mx-auto text-primary">
                {Icon}
              </div>
            </Avatar>
            <div className="flex flex-col gap-1 grow">
              <div className="flex items-center font-sm gap-1">
                <div className="line-clamp-1 text-sm">{title}</div>
              </div>
              <div className="text-xs text-gray-500">{description}</div>
            </div>
            {<Option />}
          </div>
        </Card>
      ))}

      <h5>
        {intl.formatMessage({
          id: "app.profile.editAccount",
          description: "Edit Account",
        })}
      </h5>
      <Card>
        <div className="flex flex-col gap-3">
          <FormInput
            id="display-name"
            label={intl.formatMessage({
              id: "app.profile.displayName",
              defaultMessage: "Display name",
            })}
            value={displayName}
            onChange={(e) => setDisplayName(e.currentTarget.value)}
            placeholder={intl.formatMessage({
              id: "app.profile.displayName.placeholder",
              defaultMessage: "e.g. Maria",
            })}
            className="mt-1"
          />
          <div className="flex justify-end">
            <Button
              variant="primary"
              mode="filled"
              size="xxsmall"
              label={
                saving
                  ? intl.formatMessage({ id: "app.common.saving", defaultMessage: "Saving..." })
                  : intl.formatMessage({ id: "app.common.save", defaultMessage: "Save" })
              }
              onClick={handleSave}
              disabled={saving || !displayName?.trim()}
            />
          </div>
        </div>
      </Card>
      {accountSettings.map(({ title, Icon, description, isLinked, link, unlink }) => (
        <Card key={title}>
          <div className="flex flex-row items-center gap-3 justify-center w-full">
            <Avatar>
              <div className="flex items-center justify-center text-center mx-auto text-primary">
                {Icon}
              </div>
            </Avatar>
            <div className="flex flex-col gap-1 grow">
              <div className="flex items-center font-sm gap-1">
                <div className="line-clamp-1 text-sm">{title}</div>
              </div>
              <div className="text-xs text-gray-500">{description}</div>
            </div>
            <Button
              variant={isLinked ? "neutral" : "primary"}
              label={
                isLinked
                  ? intl.formatMessage({
                      id: "app.account.unlink",
                      description: "Unlink",
                    })
                  : intl.formatMessage({
                      id: "app.account.link",
                      description: "Link",
                    })
              }
              onClick={isLinked ? unlink : link}
              mode={isLinked ? "stroke" : "filled"}
              size="xxsmall"
              className="min-w-18"
            />
          </div>
        </Card>
      ))}
      <Button
        variant="neutral"
        mode="stroke"
        onClick={logout}
        label={intl.formatMessage({
          id: "app.profile.logout",
          description: "Logout",
        })}
        leadingIcon={<RiLogoutBoxRLine className="w-4" />}
      />
    </>
  );
};
