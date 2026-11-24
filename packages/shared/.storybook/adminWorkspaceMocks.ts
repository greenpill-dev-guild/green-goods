import type { ReactElement } from "react";
import { mocked } from "storybook/test";
import App from "../../admin/src/App";
import { initializePostHog } from "../src/modules/app/posthog-browser";
import { resetHookMocks } from "./moduleMocks";

/** Preview-registered spies only: replace route entry and suppress telemetry for this story. */
export function installAdminWorkspaceStoryMocks(routeEntry: () => ReactElement): () => void {
  mocked(App).mockImplementation(routeEntry);
  mocked(initializePostHog).mockImplementation(() => undefined);
  return resetHookMocks(App, initializePostHog);
}
