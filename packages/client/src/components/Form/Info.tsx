import { RemixiconComponentType } from "@remixicon/react";

interface FormInfoProps {
  title: string;
  info: string;
  variant?: "primary" | "secondary" | "tertiary";
  Icon?: RemixiconComponentType;
}

const variants = {
  primary: "bg-teal-50 border-teal-200 border-1 shadow-md",
  secondary: "bg-green-100 text-green-700",
  tertiary: "bg-yellow-100 text-yellow-700",
};

export const FormInfo = ({
  title,
  info,
  variant = "primary",
  Icon,
  ...props
}: FormInfoProps) => {
  const variantClasses = variants[variant];

  return (
    <div
      className={`${variantClasses} p-4 rounded-lg flex mb-4 max-h-36`}
      {...props}
    >
      {Icon && <Icon size={24} />}
      <div className="flex flex-col gap-0.5">
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-700">{info}</p>
      </div>
    </div>
  );
};
