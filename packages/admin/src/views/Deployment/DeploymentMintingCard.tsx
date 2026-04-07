import { RiShieldCheckLine } from "@remixicon/react";
import type { useIntl } from "react-intl";
import { Card } from "@/components/ui/Card";

type FormatMessage = ReturnType<typeof useIntl>["formatMessage"];

interface DeploymentMintingCardProps {
  formatMessage: FormatMessage;
  isOpenMinting?: boolean;
  openMintingLoading: boolean;
  setOpenMintingPending: boolean;
  setOpenMinting: (isOpen: boolean) => void;
}

export function DeploymentMintingCard({
  formatMessage,
  isOpenMinting,
  openMintingLoading,
  setOpenMintingPending,
  setOpenMinting,
}: DeploymentMintingCardProps) {
  return (
    <Card padding="feature">
      <div className="flex items-center mb-4">
        <RiShieldCheckLine className="h-5 w-5 text-primary-base mr-2" />
        <h2 className="text-lg font-medium text-text-strong">
          {formatMessage({
            id: "app.deployment.openMinting.title",
            defaultMessage: "Garden Minting Access",
          })}
        </h2>
      </div>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm text-text-strong">
            {formatMessage({
              id: "app.deployment.openMinting.label",
              defaultMessage: "Open minting",
            })}
          </p>
          <p className="text-xs text-text-sub">
            {isOpenMinting
              ? formatMessage({
                  id: "app.deployment.openMinting.openDescription",
                  defaultMessage: "Anyone can create a garden",
                })
              : formatMessage({
                  id: "app.deployment.openMinting.restrictedDescription",
                  defaultMessage: "Only allowlisted addresses and the owner can create gardens",
                })}
          </p>
        </div>
        <button
          type="button"
          disabled={openMintingLoading || setOpenMintingPending}
          onClick={() => setOpenMinting(!isOpenMinting)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-base focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            isOpenMinting ? "bg-primary-base" : "bg-bg-strong"
          }`}
          role="switch"
          aria-checked={!!isOpenMinting}
          aria-label={formatMessage({
            id: "app.deployment.openMinting.toggle",
            defaultMessage: "Toggle open minting",
          })}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isOpenMinting ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </Card>
  );
}
