import { defineContentScript } from "wxt/utils/define-content-script";
import { probeModelContext, publishProbeResult } from "../src/webmcp/probe";

// Main world: the page's own JavaScript world, where document.modelContext is known to exist when
// the WebMCP flag is on. The comparison with the isolated-world script answers G1's question.
export default defineContentScript({
  matches: ["http://127.0.0.1/*", "http://localhost/*"],
  runAt: "document_idle",
  world: "MAIN",
  async main() {
    publishProbeResult(await probeModelContext("main"));
  },
});
