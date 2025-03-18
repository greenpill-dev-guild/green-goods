import { RemixiconComponentType } from "@remixicon/react";

interface FormInfoProps {
  title: string;
  info: string;
  variant?: "primary" | "secondary" | "tertiary";
  Icon?: RemixiconComponentType;
}

const variants = {
  primary: "bg-slate-100 border-slate-200 border-1 shadow-md",
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
      className={`${variantClasses} p-4 rounded-lg flex gap-2 mb-4 max-h-36`}
      {...props}
    >
      {Icon && (
        <div className="bg-white h-12 w-12 p-3 rounded-full">
          <Icon size={24} className="text-teal-500" />
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        <h3 className="text-xl font-medium text-slate-800">{title}</h3>
        <p className="text-xs leading-tight text-slate-700">{info}</p>
      </div>
    </div>
  );
};
