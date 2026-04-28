import { RiTimeLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { EmptyState } from "@/components/Communication";

interface ComingSoonStubProps {
  tabName: string;
}

export const ComingSoonStub: React.FC<ComingSoonStubProps> = ({ tabName }) => {
  const { formatMessage } = useIntl();

  return (
    <EmptyState
      icon={<RiTimeLine />}
      title={tabName}
      description={formatMessage({ id: "app.cookieJar.comingSoon" })}
    />
  );
};
