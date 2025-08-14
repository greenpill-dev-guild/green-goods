import { useMemo, useState } from "react";
import { normalizeToJSON } from "@/lib/ai/normalize";
import { SYSTEM_PROMPT_EN } from "@/lib/ai/prompts/system.en";
import { SYSTEM_PROMPT_ES } from "@/lib/ai/prompts/system.es";
import { SYSTEM_PROMPT_PT } from "@/lib/ai/prompts/system.pt";
import { detectLang } from "@/lib/ai/languages";
import { pinFileToIPFS, pinJSONToIPFS } from "@/lib/ipfs/pin";
import type { WorkSession } from "@/schemas/workSession";
import { MicButton } from "./MicButton";
import { ReviewCard } from "./ReviewCard";

export function ChatPanel(props: {
  imageFiles: File[];
  startTime?: string;
  endTime?: string;
  onReady: (work: WorkSession, metadataCID: string, mediaCIDs: string[]) => void;
  llm: { complete: (args: { system: string; input: string }) => Promise<string> } | null;
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<WorkSession | null>(null);
  const [mediaCIDs, setMediaCIDs] = useState<string[] | null>(null);

  const systemPrompt = useMemo(() => {
    const lang = detectLang(text);
    if (lang === "es") return SYSTEM_PROMPT_ES;
    if (lang === "pt") return SYSTEM_PROMPT_PT;
    return SYSTEM_PROMPT_EN;
  }, [text]);

  async function ensureMediaCIDs(files: File[]) {
    if (mediaCIDs) return mediaCIDs;
    const cids: string[] = [];
    for (const f of files) {
      const cid = await pinFileToIPFS(f);
      cids.push(cid);
    }
    setMediaCIDs(cids);
    return cids;
  }

  async function handleNormalize() {
    setPending(true);
    setError(null);
    try {
      const cids = await ensureMediaCIDs(props.imageFiles);
      const photos = [
        { type: "before" as const, cid: cids[0] },
        { type: "after" as const, cid: cids[cids.length - 1] },
      ];
      const work = await normalizeToJSON(
        props.llm ?? { complete: async () => "{}" },
        { userText: text, photos, startTime: props.startTime, endTime: props.endTime },
        systemPrompt
      );
      setPreview(work);
      const metadataCID = await pinJSONToIPFS(work);
      props.onReady(work, metadataCID, cids);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        className="w-full rounded border p-3"
        rows={4}
        placeholder="Tell me what you did… (puedes hablar en español / você pode falar em português)"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex gap-2 items-center">
        <MicButton onText={setText} />
        <button
          disabled={pending || !text.trim() || props.imageFiles.length === 0}
          onClick={handleNormalize}
          className="px-4 py-2 rounded bg-emerald-600 text-white"
          type="button"
        >
          Let the AI structure it
        </button>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {preview && <ReviewCard data={preview} />}
    </div>
  );
}
