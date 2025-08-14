import { useEffect, useMemo, useRef, useState } from "react";

export type LLMProxy = {
  complete: (args: { system: string; input: string }) => Promise<string>;
};

export function useLocalLLM() {
  const workerRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const worker = new Worker(new URL("@/workers/ai-worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "ready") setReady(true);
    };
    worker.addEventListener("message", onMessage);
    worker.postMessage({ type: "init" });
    return () => {
      worker.removeEventListener("message", onMessage);
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const api: LLMProxy | null = useMemo(() => {
    if (!workerRef.current) return null;
    return {
      complete: (args) =>
        new Promise((resolve) => {
          const id = Math.random().toString(36).slice(2);
          const onMessage = (e: MessageEvent) => {
            if (e.data?.type === "complete" && e.data?.id === id) {
              workerRef.current?.removeEventListener("message", onMessage);
              resolve(e.data.text as string);
            }
          };
          workerRef.current?.addEventListener("message", onMessage);
          workerRef.current?.postMessage({ type: "complete", id, ...args });
        }),
    };
  }, [workerRef.current, ready]);

  return { llm: api, ready } as const;
}
