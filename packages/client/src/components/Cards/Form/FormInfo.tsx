import type { RemixiconComponentType } from "@remixicon/react";
import { cn } from "@green-goods/shared/utils";
import { Card } from "../Base/Card";

interface FormInfoProps {
  title: string;
  info: string;
  variant?: "primary" | "secondary" | "tertiary";
  Icon?: RemixiconComponentType;
  className?: string;
}

const variants = {
  primary: "bg-bg-weak-50 text-text-strong-950",
  secondary: "bg-success-lighter text-success-dark border border-success-light",
  tertiary: "bg-warning-lighter text-warning-dark border border-warning-light",
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
        <div className="bg-bg-white-0 h-12 w-12 p-3 rounded-full border border-stroke-soft-200">
          <Icon size={24} className="text-primary" />
        </div>
      )}
      <div className="flex flex-col gap-0.5 grow">
        <h6 className="text-text-strong-950">{title}</h6>
        <div className="text-xs leading-tight text-text-sub-600">{info}</div>
      </div>
    </Card>
  );
};
