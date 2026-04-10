import { Button } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { SeedlingIllustration } from "./SeedlingIllustration";

interface CockpitGardenAccessStateProps {
  canCreateGarden: boolean;
  onCreateGarden: () => void;
}

export function CockpitGardenAccessState({
  canCreateGarden,
  onCreateGarden,
}: CockpitGardenAccessStateProps) {
  const { formatMessage } = useIntl();

  return (
    <section
      className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center"
      data-testid="cockpit-no-garden-access"
    >
      <SeedlingIllustration className="h-28 w-28" />
      <h1 className="mt-5 text-xl font-semibold text-text-strong">
        {formatMessage({
          id: "cockpit.access.noGardenTitle",
          defaultMessage: "No garden access yet",
        })}
      </h1>
      <p className="mt-2 max-w-md text-sm text-text-sub">
        {formatMessage({
          id: canCreateGarden
            ? "cockpit.access.noGardenDescriptionCanCreate"
            : "cockpit.access.noGardenDescription",
          defaultMessage: canCreateGarden
            ? "This wallet is not assigned to an operator or evaluator garden yet. Create a garden to start working in the cockpit."
            : "This wallet is not assigned to an operator or evaluator garden yet. Ask a garden owner or operator to add you before using the cockpit.",
        })}
      </p>
      {canCreateGarden ? (
        <Button className="mt-6" onClick={onCreateGarden}>
          {formatMessage({
            id: "cockpit.workspace.createGarden",
            defaultMessage: "Create Garden",
          })}
        </Button>
      ) : null}
    </section>
  );
}
