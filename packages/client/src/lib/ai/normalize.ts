import { WorkSessionSchema } from "@/schemas/workSession";
import { detectLang } from "./languages";
import { normalizeAction } from "./actionMap";

export type NormalizeInput = {
  userText: string;
  photos: { type: "before" | "after"; cid: string }[];
  startTime?: string;
  endTime?: string;
};

export async function normalizeToJSON(llm: any, input: NormalizeInput, systemPrompt: string) {
  const lang = detectLang(input.userText);
  const hintedAction = normalizeAction(input.userText);
  const hint = hintedAction ? `\nHINT actionType: ${hintedAction}\n` : "\n";

  const userMsg = `
${hint}
USER_TEXT:
${input.userText}

PHOTOS:
${JSON.stringify(input.photos)}
START: ${input.startTime ?? ""}
END: ${input.endTime ?? ""}
LANG: ${lang}
`;

  const raw = await llm.complete({ system: systemPrompt, input: userMsg });
  const parsed = JSON.parse(raw);
  parsed.photos = input.photos;
  parsed.lang = lang;
  parsed.aiAssisted = true;

  const result = WorkSessionSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Normalization failed: " + JSON.stringify(result.error.issues));
  }
  return result.data;
}
