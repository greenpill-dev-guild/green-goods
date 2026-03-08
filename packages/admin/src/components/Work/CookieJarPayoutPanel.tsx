import {
  type Address,
  formatTokenAmount,
  getVaultAssetSymbol,
  useGardenCookieJars,
} from "@green-goods/shared";
import { RiCupLine, RiHandCoinLine, RiSettings3Line, RiWalletLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CookieJarDepositModal } from "./CookieJarDepositModal";
import { CookieJarManageModal } from "./CookieJarManageModal";
import { CookieJarWithdrawModal } from "./CookieJarWithdrawModal";

interface CookieJarPayoutPanelProps {
  gardenAddress: Address;
  canManage: boolean;
  isOwner: boolean;
}

export const CookieJarPayoutPanel: React.FC<CookieJarPayoutPanelProps> = ({
  gardenAddress,
  canManage,
  isOwner,
}) => {
  const { formatMessage } = useIntl();

  const {
    jars,
    isLoading: jarsLoading,
    moduleConfigured: jarsModuleConfigured,
  } = useGardenCookieJars(gardenAddress, {
    enabled: Boolean(gardenAddress),
  });

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  // Return null when module not configured, still loading, or no jars exist
  if (!jarsModuleConfigured || jarsLoading || jars.length === 0) return null;

  return (
    <>
      <Card className="overflow-hidden">
        {/* Header: Cookie Jars with balance badges */}
        <Card.Header>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-lighter">
                <RiCupLine className="h-5 w-5 text-warning-dark" />
              </div>
              <div>
                <h3 className="label-md text-text-strong sm:text-lg">
                  {formatMessage({
                    id: "app.cookieJar.payoutTitle",
                    defaultMessage: "Cookie Jars",
                  })}
                </h3>
                <p className="mt-0.5 text-sm text-text-sub">
                  {formatMessage({
                    id: "app.cookieJar.payoutDescription",
                    defaultMessage: "Gardeners claim rewards from cookie jars for completed work",
                  })}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {jars.map((jar) => {
                const symbol = getVaultAssetSymbol(jar.assetAddress, undefined);
                return (
                  <span
                    key={jar.jarAddress}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      jar.isPaused
                        ? "bg-warning-lighter text-warning-dark"
                        : "bg-success-lighter text-success-dark"
                    }`}
                  >
                    {formatTokenAmount(jar.balance, jar.decimals)} {symbol}
                  </span>
                );
              })}
            </div>
          </div>
        </Card.Header>

        {/* Body: Action buttons */}
        <Card.Body>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="md" onClick={() => setWithdrawOpen(true)}>
              <RiHandCoinLine className="h-4 w-4" />
              {formatMessage({
                id: "app.cookieJar.withdraw",
                defaultMessage: "Withdraw",
              })}
            </Button>
            <Button variant="secondary" size="md" onClick={() => setDepositOpen(true)}>
              <RiWalletLine className="h-4 w-4" />
              {formatMessage({
                id: "app.cookieJar.fundJars",
                defaultMessage: "Fund Jars",
              })}
            </Button>
            {canManage && (
              <Button variant="ghost" size="md" onClick={() => setManageOpen(true)}>
                <RiSettings3Line className="h-4 w-4" />
                {formatMessage({
                  id: "app.cookieJar.manageJars",
                  defaultMessage: "Manage Jars",
                })}
              </Button>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* Modals */}
      <CookieJarWithdrawModal
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        gardenAddress={gardenAddress}
      />
      <CookieJarDepositModal
        isOpen={depositOpen}
        onClose={() => setDepositOpen(false)}
        gardenAddress={gardenAddress}
      />
      <CookieJarManageModal
        isOpen={manageOpen}
        onClose={() => setManageOpen(false)}
        gardenAddress={gardenAddress}
        canManage={canManage}
        isOwner={isOwner}
      />
    </>
  );
};
