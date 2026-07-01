import React, { useState } from "react";
import { useIntl } from "react-intl";
import { ModalDrawer, type ModalDrawerTab } from "@/components/Dialogs/ModalDrawer";
import { ComingSoonStub } from "./ComingSoonStub";
import { CookieJarTab } from "./CookieJarTab";
import { SendTab } from "./SendTab";

interface WalletDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletDrawer: React.FC<WalletDrawerProps> = ({ isOpen, onClose }) => {
  const { formatMessage } = useIntl();
  const [activeTab, setActiveTab] = useState("cookie-jar");
  // Bumped whenever the Tokens tab is (re)selected, so re-tapping it resets the
  // send flow back to step 1.
  const [sendResetNonce, setSendResetNonce] = useState(0);

  const tabs: ModalDrawerTab[] = [
    { id: "cookie-jar", label: formatMessage({ id: "app.wallet.tab.cookies" }) },
    { id: "send", label: formatMessage({ id: "app.wallet.tab.tokens" }) },
    { id: "pools", label: formatMessage({ id: "app.wallet.tab.commitments" }) },
  ];

  return (
    <ModalDrawer
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
      contentClassName="overflow-y-auto p-0"
      maxHeight="95vh"
    >
      {activeTab === "cookie-jar" && <CookieJarTab />}
      {activeTab === "send" && <SendTab resetNonce={sendResetNonce} />}
      {activeTab === "pools" && (
        <ComingSoonStub tabName={formatMessage({ id: "app.wallet.tab.commitments" })} />
      )}
    </ModalDrawer>
  );
};
