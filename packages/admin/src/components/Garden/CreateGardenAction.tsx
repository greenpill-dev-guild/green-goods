import { RiAddLine } from "@remixicon/react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

interface CreateGardenActionProps {
  canDeploy: boolean;
  isLoading: boolean;
  createLabel: string;
  tooltip: string;
}

export function CreateGardenAction({
  canDeploy,
  isLoading,
  createLabel,
  tooltip,
}: CreateGardenActionProps) {
  if (isLoading) {
    return (
      <Button size="sm" disabled loading>
        <RiAddLine className="mr-1.5 h-4 w-4" />
        {createLabel}
      </Button>
    );
  }

  if (canDeploy) {
    return (
      <Button size="sm" asChild>
        <Link to="/gardens/create">
          <RiAddLine className="mr-1.5 h-4 w-4" />
          {createLabel}
        </Link>
      </Button>
    );
  }

  return (
    <span
      className="inline-flex"
      data-tooltip={tooltip}
      title={tooltip}
      tabIndex={0}
      aria-label={tooltip}
    >
      <Button size="sm" disabled>
        <RiAddLine className="mr-1.5 h-4 w-4" />
        {createLabel}
      </Button>
    </span>
  );
}
