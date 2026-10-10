import { useIntl } from "react-intl";

import { FormProgress } from "@/components/Communication";
import { TopNav } from "@/components/Navigation";
import { FixedBar } from "../FixedBar";

/**
 * The composer's chrome: back, the four-beat progress, a body, a bar. The top
 * nav and the bar are fixed to the viewport, as on the work view.
 */
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
    <div className="w-full">
      <TopNav onBackClick={onBack} overlay>
        {progress ? <FormProgress currentStep={progress} steps={steps} /> : null}
      </TopNav>
      <div className="flex flex-col gap-4 p-4 pt-20">
        <p className="text-xs font-medium uppercase tracking-wide text-text-soft-400">{title}</p>
        {children}
      </div>
      {bar ? <FixedBar>{bar}</FixedBar> : null}
    </div>
  );
}
