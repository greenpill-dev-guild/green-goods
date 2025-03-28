import { cn } from "@/utils/cn";
import type * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { Card } from "../Card/Card";
import { Avatar } from "../Avatar/Avatar";
import type { RemixiconComponentType } from "@remixicon/react";

const modalVariants = tv({
  slots: {
    root: "flex flex-col items-center rounded-4xl border p-8 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-nowrap whitespace-nowrap",
    icon: "flex",
    avatar:
      "relative border-0 w-20 h-20 p-2 rounded-full flex items-center justify-center",
    spinner:
      "absolute left-0 top-0 w-full h-full upload-spinner border-success-base/50 border-3",
  },
  variants: {
    variant: {
      error: {
        avatar: "bg-error-base/10 text-static-white",
        icon: "text-error-base",
      },
      pending: {
        avatar: "bg-success-base/10 text-static-white",
        icon: "text-success-base",
      },
      success: {
        avatar: "bg-success-base/10 text-static-white",
        icon: "text-success-base",
      },
    },
  },
  defaultVariants: {
    variant: "success",
  },
});

export type ModalVariantRoot = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof modalVariants> & {
    headerText: string;
    bodyText: string;
    icon: RemixiconComponentType;
    spinner?: boolean;
  };

function UploadModal({
  className,
  variant,
  headerText,
  bodyText,
  icon: ModalIcon,
  spinner: showSpinner = true,
  ...props
}: ModalVariantRoot) {
  const { root, icon, avatar, spinner } = modalVariants({ variant });
  return (
    <Card {...props} className={root()}>
      <div className="relative flex flex-col gap-4 items-center justify-center">
        <Avatar className={avatar()}>
          <div className={cn(showSpinner && "animate-spin" && spinner())} />
          <div className="w-full h-full flex items-center justify-center">
            <ModalIcon className={icon()} />
          </div>
        </Avatar>
        <h6>{headerText}</h6>
        <div
          className="flex mx-4 max-w-full text-wrap text-center"
          dangerouslySetInnerHTML={{ __html: bodyText }}
        />
      </div>
    </Card>
  );
}

export { UploadModal, modalVariants };
