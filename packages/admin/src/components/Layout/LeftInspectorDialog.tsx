import { AdminDialog } from "@/components/AdminDialog";
import { useLeftSheetConfigValue } from "./leftSheetChannel";

/**
 * Renders the persistent left-inspector descriptor through the canonical admin
 * dialog. Route-backed descriptors preserve deep links through their onClose.
 */
export function LeftInspectorDialog({
  fallbackTone,
}: {
  fallbackTone: "hub" | "garden" | "community" | "actions";
}) {
  const config = useLeftSheetConfigValue();
  const isOpen = config !== null;

  return (
    <AdminDialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) config?.onClose?.();
      }}
      title={config?.title ?? ""}
      tone={config?.tone ?? fallbackTone}
      size={config?.size ?? "lg"}
      preventClose={config?.preventClose}
    >
      {config?.content}
    </AdminDialog>
  );
}
