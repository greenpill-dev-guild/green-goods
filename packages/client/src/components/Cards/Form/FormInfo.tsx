import { cn } from "@green-goods/shared/utils/styles/cn";
import type { RemixiconComponentType } from "@remixicon/react";
import type { ReactNode } from "react";
import { Card } from "../Card";

interface FormInfoProps {
  title: string;
  /** Usually words; a sentence that names someone renders the name as its own element. */
  info: ReactNode;
  variant?: "primary" | "secondary" | "tertiary";
  Icon?: RemixiconComponentType;
  /**
   * Merged last, so a page whose explanation runs long (the public reporting pages, in any
   * language and at any text size) can lift the card's 9rem cap with `max-h-none`.
   */
  className?: string;
  /** `h1` when the card heads a page of its own, as on the public reporting pages. */
  titleAs?: "h1" | "h6";
  /** Lets the page name itself by the card's title. */
  headingId?: string;
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
  titleAs: Title = "h6",
  headingId,
  ...props
}: FormInfoProps) => {
  const variantClasses = variants[variant];

  return (
    <Card
      className={cn(variantClasses, "p-4 rounded-lg flex gap-4 max-h-36", className)}
      variant="primary"
      mode="filled"
      {...props}
    >
      {Icon && (
        <div className="bg-bg-white-0 h-12 w-12 shrink-0 p-3 rounded-full border border-stroke-soft-200">
          <Icon size={24} className="text-primary-on-surface" />
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-0.5 grow [overflow-wrap:anywhere]">
        <Title id={headingId} className="text-base font-semibold text-text-strong-950">
          {title}
        </Title>
        <div className="text-xs leading-tight text-text-sub-600">{info}</div>
      </div>
    </Card>
  );
};
