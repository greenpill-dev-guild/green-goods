import { SheetActions } from "@green-goods/shared/components/Dialog/SheetActions";
import { WorkUploadConsentContent } from "@green-goods/shared/components/Dialog/WorkUploadConsentDialog";
import type { ComponentProps } from "react";
import { AdminDialog } from "./AdminDialog";

type ConsentProps = Pick<ComponentProps<typeof WorkUploadConsentContent>, "prompt" | "kind">;

export function AdminUploadConsentDialog({ prompt, kind }: ConsentProps) {
  if (!prompt) return null;
  return (
    <WorkUploadConsentContent
      prompt={prompt}
      kind={kind}
      render={({ title, description, actions, content }) => (
        <AdminDialog
          open
          size="md"
          title={title}
          description={description}
          preventClose={prompt.saving}
          onOpenChange={(open) => !open && prompt.cancel()}
          actions={<SheetActions {...actions} />}
        >
          {content}
        </AdminDialog>
      )}
    />
  );
}
