import { useEffect, useRef, useState } from "react";

export type STTState = {
  listening: boolean;
  transcript: string;
  error?: string;
};

export function useSpeechToText() {
  const [state, setState] = useState<STTState>({ listening: false, transcript: "" });
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      recognitionRef.current = rec;
      rec.lang = "en-US";
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (event: any) => {
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          finalText += res[0].transcript;
        }
        setState((s) => ({ ...s, transcript: finalText }));
      };
      rec.onend = () => setState((s) => ({ ...s, listening: false }));
      rec.onerror = (e: any) => setState((s) => ({ ...s, error: String(e?.error || e) }));
    }
    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {}
    };
  }, []);

  const start = () => {
    setState((s) => ({ ...s, listening: true, transcript: "" }));
    try {
      recognitionRef.current?.start?.();
    } catch {}
  };
  const stop = () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {}
  };

  return { ...state, start, stop } as const;
}
