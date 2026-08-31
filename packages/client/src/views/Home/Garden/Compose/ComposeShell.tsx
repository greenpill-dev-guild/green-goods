import { useIntl } from "react-intl";

import { FormProgress } from "@/components/Communication";
import { TopNav } from "@/components/Navigation";

export function ComposeShell({
  children,
  onBack,
  title,
  progress,
  bar,
}: {
  children: React.ReactNode;
  onBack: () => void;
  title: string;
  progress?: number;
  bar?: React.ReactNode;
}) {
  const { formatMessage } = useIntl();
  const steps = [
    formatMessage({ id: "app.compose.beat.what" }),
    formatMessage({ id: "app.compose.beat.howMuch" }),
    formatMessage({ id: "app.compose.beat.details" }),
    formatMessage({ id: "app.compose.beat.review" }),
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <TopNav onBackClick={onBack}>
        {progress ? <FormProgress currentStep={progress} steps={steps} /> : null}
      </TopNav>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex flex-1 flex-col gap-4 p-4 pb-24">
          <p className="text-xs font-medium uppercase tracking-wide text-text-soft-400">{title}</p>
          {children}
        </div>
      </div>
      {bar}
    </div>
  );
}
