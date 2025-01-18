import { RemixiconComponentType } from "@remixicon/react";

interface FormCardProps {
  label: string;
  value: string;
  variant?: "primary" | "secondary" | "tertiary";
  Icon?: RemixiconComponentType;
}

const variants = {
  primary: "bg-teal-50 border-teal-200 border-1 shadow-md",
  secondary: "bg-green-100 text-green-700",
  tertiary: "bg-yellow-100 text-yellow-700",
};

export const FormCard = ({
  label,
  value,
  variant = "primary",
  Icon,
  ...props
}: FormCardProps) => {
  const variantClasses = variants[variant];

  return (
    <div
      className={`${variantClasses} p-4 rounded-lg flex mb-4 max-h-36`}
      {...props}
    >
      <div className="flex gap-0.5">
        {Icon && <Icon size={24} />}
        <h3 className="text-lg font-bold text-slate-800">{label}</h3>
      </div>
      <p className="text-sm text-slate-700">{value}</p>
    </div>
  );
};
