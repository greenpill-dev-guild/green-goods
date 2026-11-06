import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { useUploadPolicy } from "../../hooks/work/useUploadPolicy";
import { UploadPolicyCancelledError } from "../../modules/work/upload-policy";
import { Button } from "../Button";
import { WorkUploadConsentDialog } from "./WorkUploadConsentDialog";

const ACCOUNT = "0x1111111111111111111111111111111111111111";

/** A fictional local account; this story never queues, uploads or signs work. */
function ConsentExample() {
  const [signedIn, setSignedIn] = useState(false);
  const { locale } = useIntl();
  const policy = useUploadPolicy(signedIn ? ACCOUNT : null, locale, true);
  const [result, setResult] = useState("Browsing");
  return (
    <div className="p-6 space-y-4">
      <p>Fictional account rehearsal. Nothing is uploaded or signed.</p>
      <Button onClick={() => setSignedIn(!signedIn)}>{signedIn ? "Sign Out" : "Sign In"}</Button>
      {signedIn ? (
        <Button
          onClick={() => {
            void policy.request().then(
              () => setResult("Ready to upload"),
              (error) => {
                if (error instanceof UploadPolicyCancelledError)
                  setResult("Canceled without an upload");
                else throw error;
              }
            );
          }}
        >
          Submit Work
        </Button>
      ) : null}
      <p role="status">{result}</p>
      <WorkUploadConsentDialog prompt={policy.prompt} />
    </div>
  );
}
const meta = {
  title: "Shared/Dialogs/WorkUploadConsent",
  component: ConsentExample,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ConsentExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const BeforeSharing: Story = {};
