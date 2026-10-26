import { useVoucherWallet } from "@green-goods/shared/commitment-pooling";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useAccessibleCookieJars } from "@green-goods/shared/hooks/cookie-jar/useAccessibleCookieJars";
import type { Address } from "@green-goods/shared/types/domain";
import { getNetworkContracts } from "@green-goods/shared/utils/blockchain/contracts";
import { RiCoinsLine, RiCoupon3Line, RiGiftLine } from "@remixicon/react";
import React, { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { AppSheet, type AppSheetTab } from "@/components/Sheets/AppSheet";
import { CookieJarTab } from "./CookieJarTab";
import { SendTab } from "./SendTab";
import { VouchersTab } from "./VouchersTab";
import { hasVoucherWallet } from "./voucherWallet";

interface WalletSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The wallet holds balances: one fungible number each, no lifecycle, nothing
 * waiting on anyone. Commitments left for their own sheet because they are none
 * of those things (see views/Home/CommitmentsSheet). Vouchers are balances too;
 * a voucher a booking holds shows as its own row that opens the booking, since
 * the wallet is account-wide and Home shows one garden (PRD-1299 decision 11).
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

  // The account's vouchers across gardens, read while the sheet is open. Until the voucher
  // pilot's deployment is adopted the read is unavailable and the tab stays out.
  const { primaryAddress } = useUser();
  const voucherScope = useMemo(
    () =>
      isOpen && primaryAddress
        ? {
            sourceChainId: DEFAULT_CHAIN_ID,
            coreModule: getNetworkContracts(DEFAULT_CHAIN_ID).commitmentPoolingModule,
            account: primaryAddress as Address,
          }
        : null,
    [isOpen, primaryAddress]
  );
  const voucherWallet = useVoucherWallet(voucherScope).data;
  const showVouchers = hasVoucherWallet(voucherWallet);
  const tab = activeTab === "vouchers" && !showVouchers ? "cookie-jar" : activeTab;

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
    ...(showVouchers
      ? [
          {
            id: "vouchers",
            label: formatMessage({ id: "app.wallet.tab.vouchers" }),
            icon: <RiCoupon3Line />,
          },
        ]
      : []),
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
      activeTab={tab}
      onTabChange={(id) => {
        setActiveTab(id);
        if (id === "send") setSendResetNonce((nonce) => nonce + 1);
      }}
      contentClassName="flex min-h-0 flex-col overflow-hidden p-0"
      size="full"
    >
      {tab === "cookie-jar" && <CookieJarTab />}
      {tab === "send" && <SendTab resetNonce={sendResetNonce} />}
      {tab === "vouchers" && showVouchers && (
        <VouchersTab wallet={voucherWallet} onClose={onClose} />
      )}
    </AppSheet>
  );
};
