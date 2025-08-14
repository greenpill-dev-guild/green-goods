import { RiMicFill, RiStopFill } from "@remixicon/react";
import React from "react";
import { useSpeechToText } from "@/hooks/useSpeechToText";

export const MicButton: React.FC<
  { onText: (t: string) => void } & React.HTMLAttributes<HTMLButtonElement>
> = ({ onText, ...rest }) => {
  const { listening, transcript, start, stop } = useSpeechToText();

  React.useEffect(() => {
    if (transcript) onText(transcript);
  }, [transcript]);

  return (
    <button
      {...rest}
      type="button"
      onClick={() => (listening ? stop() : start())}
      className={`px-3 py-2 rounded ${listening ? "bg-red-600 text-white" : "bg-gray-100"}`}
      aria-pressed={listening}
    >
      {listening ? <RiStopFill className="w-5 h-5" /> : <RiMicFill className="w-5 h-5" />}
    </button>
  );
};
