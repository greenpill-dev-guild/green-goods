import { useAccessibleCookieJars } from "@green-goods/shared/hooks/cookie-jar/useAccessibleCookieJars";
import { RiCoinsLine, RiGiftLine } from "@remixicon/react";
import React, { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { AppSheet, type AppSheetTab } from "@/components/Sheets/AppSheet";
import { CookieJarTab } from "./CookieJarTab";
import { SendTab } from "./SendTab";

interface WalletSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The wallet holds balances: one fungible number each, no lifecycle, nothing
 * waiting on anyone. Commitments left for their own sheet because they are none
 * of those things (see views/Home/CommitmentsSheet).
 */
export const WalletSheet: React.FC<WalletSheetProps> = ({ isOpen, onClose }) => {
  const { formatMessage } = useIntl();
  const [activeTab, setActiveTab] = useState("cookie-jar");
  // Bumped whenever the Tokens tab is (re)selected, so re-tapping it resets the
  // Tokens tab back to its Balance home.
  const [sendResetNonce, setSendResetNonce] = useState(0);

  // Claimable-jar count for the Cookies tab badge. Gated to sheet-open so the
  // on-chain role/jar reads don't run while the sheet is closed.
  const { jars } = useAccessibleCookieJars({ enabled: isOpen });
  const claimableCookies = useMemo(
    () => jars.filter((jar) => jar.maxWithdrawal > 0n && jar.balance > 0n && !jar.isPaused).length,
    [jars]
  );

  const tabs: AppSheetTab[] = [
    {
      id: "cookie-jar",
      label: formatMessage({ id: "app.wallet.tab.cookies" }),
      icon: <RiGiftLine />,
      count: claimableCookies,
    },
    {
      id: "send",
      label: formatMessage({ id: "app.wallet.tab.tokens" }),
      icon: <RiCoinsLine />,
    },
  ];

  return (
    <AppSheet
      isOpen={isOpen}
      onClose={onClose}
      header={{
        title: formatMessage({ id: "app.wallet.title" }),
        description: formatMessage({ id: "app.wallet.subtitle" }),
      }}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => {
        setActiveTab(id);
        if (id === "send") setSendResetNonce((nonce) => nonce + 1);
      }}
      contentClassName="flex min-h-0 flex-col overflow-hidden p-0"
      size="full"
    >
      {activeTab === "cookie-jar" && <CookieJarTab />}
      {activeTab === "send" && <SendTab resetNonce={sendResetNonce} />}
    </AppSheet>
  );
};
