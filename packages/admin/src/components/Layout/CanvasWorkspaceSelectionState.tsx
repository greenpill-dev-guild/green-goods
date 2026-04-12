import { Alert, Button, Card, adminRoutes } from "@green-goods/shared";
import { RiArrowRightSLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { SeedlingIllustration } from "./SeedlingIllustration";

// Paradigm: Ritual — single-purpose garden selection, focused attention.

interface WorkspaceGarden {
  id: string;
  name: string;
  location?: string;
}

interface CanvasWorkspaceSelectionStateProps {
  workspaceLabel: string;
  gardens: WorkspaceGarden[];
  onSelectGarden: (garden: WorkspaceGarden) => void;
}

export function CanvasWorkspaceSelectionState({
  workspaceLabel,
  gardens,
  onSelectGarden,
}: CanvasWorkspaceSelectionStateProps) {
  const { formatMessage } = useIntl();

  if (gardens.length === 0) {
    return (
      <div className="px-4 py-8 sm:px-6">
        <Card className="mx-auto max-w-xl">
          <Card.Body className="flex flex-col items-center py-12 text-center">
            <SeedlingIllustration className="h-24 w-24" />
            <h2 className="mt-4 text-lg font-semibold text-text-strong">
              {formatMessage({
                id: "cockpit.workspace.noGardens",
                defaultMessage: "No gardens yet",
              })}
            </h2>
            <p className="mt-2 max-w-md text-sm text-text-sub">
              {formatMessage({
                id: "cockpit.workspace.noGardensDescription",
                defaultMessage: "Create your first garden to start using the canvas workspaces.",
              })}
            </p>
            <Button className="mt-6" asChild>
              <Link to={adminRoutes.gardenCreate()}>
                {formatMessage({
                  id: "cockpit.workspace.createGarden",
                  defaultMessage: "Create Garden",
                })}
              </Link>
            </Button>
          </Card.Body>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-6">
      <Card className="mx-auto max-w-3xl">
        <Card.Header>
          <div>
            <h2 className="label-md text-text-strong sm:text-lg">
              {formatMessage({
                id: "cockpit.workspace.chooseGardenTitle",
                defaultMessage: "Choose a garden",
              })}
            </h2>
            <p className="mt-1 text-sm text-text-sub">
              {formatMessage(
                {
                  id: "cockpit.workspace.chooseGardenDescription",
                  defaultMessage: "Select a garden to open the {workspace} workspace.",
                },
                { workspace: workspaceLabel }
              )}
            </p>
          </div>
        </Card.Header>
        <Card.Body className="space-y-4">
          <Alert variant="info">
            {formatMessage({
              id: "cockpit.workspace.chooseGardenHint",
              defaultMessage: "Use the Garden Chip in the top context bar or pick a garden below.",
            })}
          </Alert>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {gardens.map((garden) => (
              <button
                key={garden.id}
                type="button"
                onClick={() => onSelectGarden(garden)}
                className="flex items-center justify-between gap-3 rounded-xl border border-stroke-soft bg-bg-white px-4 py-3 text-left transition hover:border-primary-base hover:bg-bg-weak focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
                aria-label={formatMessage(
                  {
                    id: "cockpit.workspace.openGarden",
                    defaultMessage: "Open {garden}",
                  },
                  { garden: garden.name }
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-strong">{garden.name}</p>
                  {garden.location ? (
                    <p className="mt-0.5 truncate text-xs text-text-soft">{garden.location}</p>
                  ) : null}
                </div>
                <RiArrowRightSLine className="h-4 w-4 flex-shrink-0 text-text-soft" />
              </button>
            ))}
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
