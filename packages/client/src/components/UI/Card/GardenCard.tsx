import { cn } from "@/utils/cn";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { Card, type CardRootProps } from "./Card";
import { RiUser2Fill, RiUserCommunityFill, RiUserLocationFill } from "@remixicon/react";
import { Badge } from "../Badge/Badge";
import { formatAddress } from "@/utils/text";

export const cardVariants = tv({
  base: "flex flex-col grow border rounded-lg border-card overflow-clip rounded-lg justify-between border-slate-200 p-0 gap-0",
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

export type GardenCardVariantProps = VariantProps<typeof cardVariants>;

export type GardenCardOptions = {
  showOperators?: boolean;
}

export type GardenCardRootProps = React.HTMLAttributes<HTMLDivElement> &
  GardenCardVariantProps &
  CardRootProps & { garden: Garden; selected: boolean } & GardenCardOptions;

const GardenCard = React.forwardRef<HTMLDivElement, GardenCardRootProps>(
  ({ media, className, selected, garden, showOperators = false, ...props }, ref) => {
    const classes = cardVariants({ media, class: className });
    return (
      <Card ref={ref} className={cn(classes)} {...props}>
        <img
          src={garden.bannerImage}
          alt={garden.description}
          className={cn(media === "large" ? "h-55" : "max-h-26", "object-cover image-lut")} 
        />
        <div
          data-selected={selected}
          className="p-5 flex flex-col gap-2 border-2 border-t-0 rounded-b-lg border-white data-[selected=true]:border-primary transition-all duration-400"
        >
          <div className="flex flex-col gap-2">
            <h5 className="flex items-center text-xl font-medium">
              {garden.name}
            </h5>
            <div className="flex flex-row gap-1">
              <Badge variant="outline" tint="none"><RiUserCommunityFill className="w-3.5 text-primary mx-1"/>{garden.operators.length} Gardeners</Badge>
              <Badge variant="outline" tint="none"><RiUserLocationFill className="w-3.5 text-primary mx-1"/>{garden.location}</Badge>
            </div>
            {showOperators &&(<><div className="text-xs text-slate-700 uppercase">Operators</div>
            <div className="flex flex-row gap-1 flex-wrap">
              {garden.operators.map((operator) => (
                <Badge key={operator} variant="outline" tint="none"><RiUser2Fill className="w-3.5 text-primary mx-1"/>{formatAddress(operator)}</Badge>
              ))}
            </div></>)}
          </div>
          <div className="text-sm text-slate-500">{garden.description}</div>
        </div>
      </Card>
    );
  }
);
GardenCard.displayName = "GardenCard";

export { GardenCard };
