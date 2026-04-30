import { type Address, usePrimaryAddress } from "@green-goods/shared";
import { RiArrowDropDownLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AccountInfo } from "./AccountInfo";
import { AppSettings } from "./AppSettings";
import { ENSSection } from "./ENSSection";
import { GardensList } from "./GardensList";
import { InstallCta } from "./InstallCta";

export const ProfileAccount: React.FC = () => {
  const primaryAddress = usePrimaryAddress() as Address | undefined;
  const intl = useIntl();

  return (
    <>
      <InstallCta />
      <AppSettings />
      <GardensList primaryAddress={primaryAddress} />
      <ENSSection primaryAddress={primaryAddress} />
      <details className="group flex flex-col gap-3">
        <summary className="flex cursor-pointer items-center justify-between rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 px-3 py-2 text-sm font-medium text-text-strong-950 transition-colors hover:bg-bg-weak-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
          <span className="flex flex-col">
            <span>
              {intl.formatMessage({
                id: "app.profile.accountDetailsTitle",
                defaultMessage: "Account details",
              })}
            </span>
            <span className="text-xs font-normal text-text-sub-600">
              {intl.formatMessage({
                id: "app.profile.accountDetailsHint",
                defaultMessage: "Sign-in method, address, and advanced settings.",
              })}
            </span>
          </span>
          <RiArrowDropDownLine className="h-5 w-5 shrink-0 text-text-sub-600 transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-3 pt-2">
          <AccountInfo />
        </div>
      </details>
    </>
  );
};
