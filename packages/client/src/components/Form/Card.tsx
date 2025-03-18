import { RemixiconComponentType } from "@remixicon/react";

interface FormCardProps {
  label: string;
  value: string;
  variant?: "primary" | "secondary" | "tertiary";
  Icon?: RemixiconComponentType;
}

const variants = {
  primary: "bg-transparent border-slate-100 border-2 shadow-2xs",
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
      className={`${variantClasses} rounded-lg flex flex-col divide-y-2 mb-4 shadow-md`}
      {...props}
    >
      <div className="flex items-center gap-2 px-4 py-2">
        {Icon && <Icon size={24} className="text-teal-600" />}
        <h3 className="text-lg font-medium text-slate-800">{label}</h3>
      </div>
      <p className="text-slate-700 px-4 py-3">{value}</p>
    </div>
  );
};
