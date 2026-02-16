import React, { useState } from "react";
import { useIntl } from "react-intl";
import { ModalDrawer } from "@/components/Dialogs/ModalDrawer";
import type { ModalDrawerTab } from "@/components/Dialogs/ModalDrawer";
import { CookieJarTab } from "./CookieJarTab";
import { ComingSoonStub } from "./ComingSoonStub";

interface WalletDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletDrawer: React.FC<WalletDrawerProps> = ({ isOpen, onClose }) => {
  const { formatMessage } = useIntl();
  const [activeTab, setActiveTab] = useState("cookie-jar");

  const tabs: ModalDrawerTab[] = [
    { id: "cookie-jar", label: formatMessage({ id: "app.cookieJar.title" }) },
    { id: "send", label: formatMessage({ id: "app.cookieJar.send" }) },
    { id: "pools", label: formatMessage({ id: "app.cookieJar.pools" }) },
  ];

  return (
    <ModalDrawer
      isOpen={isOpen}
      onClose={onClose}
      header={{
        title: formatMessage({ id: "app.cookieJar.wallet" }),
        description: formatMessage({ id: "app.cookieJar.walletDescription" }),
      }}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      contentClassName="overflow-y-auto p-0"
      maxHeight="95vh"
    >
      {activeTab === "cookie-jar" && <CookieJarTab />}
      {activeTab === "send" && (
        <ComingSoonStub tabName={formatMessage({ id: "app.cookieJar.send" })} />
      )}
      {activeTab === "pools" && (
        <ComingSoonStub tabName={formatMessage({ id: "app.cookieJar.pools" })} />
      )}
    </ModalDrawer>
  );
};
