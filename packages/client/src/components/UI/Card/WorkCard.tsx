import { cn } from "@/utils/cn";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { Card, type CardRootProps } from "./Card";
import { Button } from "../Button";
import { Badge } from "../Badge/Badge";
import {
  RiAlertFill,
  RiFileUnknowFill,
  RiLeafFill,
  RiSearchEyeLine,
  RiUser3Fill,
} from "@remixicon/react";
import { formatAddress } from "@/utils/text";
import { useMemo } from "react";
import { useIntl } from "react-intl";

export const cardVariants = tv({
  base: "relative flex flex-col grow border-0 rounded-lg overflow-clip rounded-lg justify-between p-0 gap-0",
  variants: {
    media: {
      large: "",
      small: "",
    },
  },
  defaultVariants: {
    media: "large",
  },
});

export type ActionCardVariantProps = VariantProps<typeof cardVariants>;

export type ActionCardRootProps = React.HTMLAttributes<HTMLDivElement> &
  ActionCardVariantProps &
  CardRootProps & { work: Work; action: Action; selected: boolean };

const WorkCard = React.forwardRef<
  HTMLDivElement,
  ActionCardRootProps & {
    onClick?: (e: React.SyntheticEvent<HTMLButtonElement>) => void;
  }
>(({ media, className, selected, work, action, onClick, ...props }, ref) => {
  const intl = useIntl();
  const classes = cardVariants({ media, class: className });

  const statusIcon = useMemo(() => {
    switch (work.status) {
      case "pending":
        return <RiAlertFill className="h-4 w-4 text-warning-base" />;
      case "approved":
        return <RiLeafFill className="h-4 w-4 text-primary-base" />;
      case "rejected":
        return <RiAlertFill className="h-4 w-4 text-error-base" />;
      default:
        return <RiFileUnknowFill className="h-4 w-4 text-muted-base" />;
    }
  }, [work.status]);

  return (
    <Card ref={ref} className={cn(classes)} {...props}>
      <img
        src={work.media[0] || "/images/no-image-placeholder.png"}
        alt={work.feedback}
        className={cn(
          media === "large" ? "h-auto aspect-video" : "max-h-26",
          "object-cover image-lut z-1"
        )}
      />
      <div
        data-selected={selected}
        className="p-4 flex flex-col gap-2 border border-t-0 rounded-b-lg border-border transition-all duration-400"
      >
        <div className="flex flex-row gap-2">
          <h6
            className={cn(
              "flex items-center text-xl font-medium",
              selected && "text-primary"
            )}
          >
            {work.title}
          </h6>
        </div>
        <div className="text-sm flex flex-row flex-wrap gap-2">
          <Badge
            variant="outline"
            leadingIcon={
              <RiSearchEyeLine className="h-4 w-4 text-primary-base" />
            }
          >
            {action.title}
          </Badge>
          <Badge
            variant="outline"
            leadingIcon={<RiUser3Fill className="h-4 w-4 text-tertiary" />}
          >
            {formatAddress(work.gardenerAddress)}
          </Badge>
          <Badge
            variant="outline"
            leadingIcon={statusIcon}
            className="capitalize"
          >
            {intl.formatMessage({
              id: "app.garden.work.status." + work.status,
              defaultMessage: work.status,
            })}
          </Badge>
          <Badge
            variant="outline"
            leadingIcon={<RiLeafFill className="h-4 w-4 text-primary-base" />}
          >
            {0}
          </Badge>
        </div>
        <div className="text-sm">{work.feedback}</div>
        <div className="border-t border-border my-2" />
        <div className="flex flex-row gap-2 items-center">
          <div className="text-xs">
            {intl.formatMessage(
              {
                id: "app.garden.publishedOn",
                defaultMessage: "Published on {date}",
              },
              { date: new Date(work.createdAt).toLocaleString() }
            )}
          </div>
          <Button
            size="small"
            label={intl.formatMessage({
              id: "app.garden.viewDetails",
              defaultMessage: "View Details",
            })}
            onClick={onClick}
          />
        </div>
      </div>
    </Card>
  );
});
WorkCard.displayName = "WorkCard";

export { WorkCard };
