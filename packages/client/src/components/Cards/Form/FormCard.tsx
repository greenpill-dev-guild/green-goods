import type { RemixiconComponentType } from "@remixicon/react";
import { cn } from "@green-goods/shared/utils";
import { Card, type CardRootProps } from "../Base/Card";

interface FormCardProps {
  label: string;
  value: string;
  Icon?: RemixiconComponentType;
}

export const FormCard = ({
  label,
  value,
  Icon,
  className,
  ...props
}: FormCardProps & CardRootProps) => {
  return (
    <Card className={cn("p-0", className)} {...props}>
      <div className="flex flex-col gap-2 w-full">
        <div className="flex flex-row p-3 border-b border-stroke-soft-200 w-full">
          {Icon && <Icon size={24} className="text-primary" />}
          <div className="px-2 font-medium text-text-strong-950">{label}</div>
        </div>
        <div className="pb-3 pl-4 pt-1 text-label-sm items-start text-left justify-start text-text-sub-600">
          {value}
        </div>
      </div>
    </Card>
  );
};
