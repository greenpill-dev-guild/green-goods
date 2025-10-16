import type { RemixiconComponentType } from "@remixicon/react";
import { cn } from "@/utils/styles/cn";
import { Card, type CardRootProps } from "../Card/Card";

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
          <div className="px-2 font-medium text-slate-800">{label}</div>
        </div>
        <div className="pb-3 pl-4 pt-1 text-label-sm items-start text-left justify-start">
          {value}
        </div>
      </div>
    </Card>
  );
};
