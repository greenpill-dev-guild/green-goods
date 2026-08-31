import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { SeedlingIllustration } from "./SeedlingIllustration";

interface CanvasGardenAccessStateProps {
  onCreateGarden: () => void;
  canCreateGarden?: boolean;
}

export function CanvasGardenAccessState({
  onCreateGarden,
  canCreateGarden = true,
}: CanvasGardenAccessStateProps) {
  const { formatMessage } = useIntl();

  return (
    <section
      className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center"
      data-testid="canvas-no-garden-access"
    >
      <SeedlingIllustration className="h-28 w-28" />
      <h1 className="mt-5 text-xl font-semibold text-text-strong">
        {formatMessage({
          id: "cockpit.access.noGardenTitle",
          defaultMessage: "No garden access yet",
        })}
      </h1>
      <p className="mt-2 max-w-md text-sm text-text-sub">
        {canCreateGarden
          ? formatMessage({
              id: "cockpit.access.noGardenDescriptionCanCreate",
              defaultMessage:
                "This wallet is not assigned to a steward or evaluator garden yet. Create a garden to start working in the canvas.",
            })
          : formatMessage({
              id: "cockpit.access.noGardenDescription",
              defaultMessage:
                "This wallet is not assigned to a steward or evaluator garden yet. Ask a garden owner or steward to add you before using the canvas.",
            })}
      </p>
      {canCreateGarden && (
        <AdminButton className="mt-6" onClick={onCreateGarden}>
          {formatMessage({
            id: "cockpit.workspace.createGarden",
            defaultMessage: "Create Garden",
          })}
        </AdminButton>
      )}
    </section>
  );
}
