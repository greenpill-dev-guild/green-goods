import type { RemixiconComponentType } from "@remixicon/react";
import { cn } from "@green-goods/shared/utils";
import { Card } from "../Card/Card";

interface FormInfoProps {
  title: string;
  info: string;
  variant?: "primary" | "secondary" | "tertiary";
  Icon?: RemixiconComponentType;
  className?: string;
}

const variants = {
  primary: "bg-slate-100",
  secondary: "bg-green-100 text-green-700",
  tertiary: "bg-yellow-100 text-yellow-700",
};

export const FormInfo = ({
  title,
  info,
  variant = "primary",
  Icon,
  className = "",
  ...props
}: FormInfoProps) => {
  const variantClasses = variants[variant];

  return (
    <Card
      className={cn(variantClasses, className, "p-4 rounded-lg flex gap-4 max-h-36")}
      variant="primary"
      mode="filled"
      {...props}
    >
      {Icon && (
        <div className="bg-white h-12 w-12 p-3 rounded-full">
          <Icon size={24} className="text-primary" />
        </div>
      )}
      <div className="flex flex-col gap-0.5 grow">
        <h6>{title}</h6>
        <div className="text-xs leading-tight text-slate-700">{info}</div>
      </div>
    </Card>
  );
};
