import { detectLang } from "@/lib/ai/languages";
import { normalizeAction } from "@/lib/ai/actionMap";

self.addEventListener("message", async (e: MessageEvent) => {
  const data = e.data as any;
  if (data?.type === "init") {
    self.postMessage({ type: "ready" });
    return;
  }
  if (data?.type === "complete") {
    // Very small heuristic JSON generator; placeholder for real WebLLM
    const input: string = String(data.input || "");
    const lang = detectLang(input);
    const act = normalizeAction(input) || "planting";
    const description = input.trim().split(/\n/)[0].slice(0, 200) || "Garden work";
    const result = {
      actionType: act,
      description,
      materialsUsed: [],
      photos: [],
      lang,
      aiAssisted: true,
    };
    self.postMessage({ type: "complete", id: data.id, text: JSON.stringify(result) });
  }
});
