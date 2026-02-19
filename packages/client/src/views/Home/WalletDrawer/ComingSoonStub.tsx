import React from "react";
import { useIntl } from "react-intl";

interface ComingSoonStubProps {
  tabName: string;
}

export const ComingSoonStub: React.FC<ComingSoonStubProps> = ({ tabName }) => {
  const { formatMessage } = useIntl();

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <p className="text-sm font-medium text-text-sub">{tabName}</p>
      <p className="mt-1 text-xs text-text-soft">
        {formatMessage({ id: "app.cookieJar.comingSoon" })}
      </p>
    </div>
  );
};
