import { defineContentScript } from "wxt/utils/define-content-script";
import { probeModelContext, publishProbeResult } from "../src/webmcp/probe";

// Isolated world: the default content script world. Chrome's example extension reads
// document.modelContext from here; G0 records whether Brave Beta exposes it to this world.
export default defineContentScript({
  matches: ["http://127.0.0.1/*", "http://localhost/*"],
  runAt: "document_idle",
  async main() {
    publishProbeResult(await probeModelContext("isolated"));
  },
});
