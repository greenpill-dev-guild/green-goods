/**
 * Deterministic chat commands. They work with every model disabled and take precedence over
 * interpretation, so STOP, DELETE and HELP can never be misread as report content.
 */
export type ChatCommand =
  | { kind: "help" }
  | { kind: "stop" }
  | { kind: "start" }
  | { kind: "delete" }
  | { kind: "cancel" }
  | { kind: "new" }
  | { kind: "status" }
  | { kind: "edit" }
  | { kind: "retry" }
  | { kind: "skip" }
  | { kind: "recover" }
  | { kind: "confirm"; token: string | null }
  | { kind: "publish"; token: string | null }
  | { kind: "pair"; code: string }
  | { kind: "review"; index: number | null }
  | { kind: "locale"; locale: "en" | "es" | "pt" };

const WORDS: Record<string, ChatCommand["kind"]> = {
  help: "help",
  ayuda: "help",
  ajuda: "help",
  stop: "stop",
  parar: "stop",
  pare: "stop",
  start: "start",
  delete: "delete",
  borrar: "delete",
  apagar: "delete",
  cancel: "cancel",
  cancelar: "cancel",
  new: "new",
  nuevo: "new",
  novo: "new",
  status: "status",
  estado: "status",
  edit: "edit",
  editar: "edit",
  retry: "retry",
  reintentar: "retry",
  skip: "skip",
  omitir: "skip",
  pular: "skip",
  recover: "recover",
  recuperar: "recover",
  confirm: "confirm",
  confirmar: "confirm",
  publish: "publish",
  publicar: "publish",
  pair: "pair",
  review: "review",
  revisar: "review",
};

const LOCALES = new Set(["en", "es", "pt"]);

export function parseCommand(text: string | undefined): ChatCommand | null {
  if (!text) return null;
  const words = text.trim().toLowerCase().split(/\s+/u);
  if (words.length === 0 || words.length > 2) return null;
  const [head, argument] = words;
  if ((head === "lang" || head === "idioma") && argument && LOCALES.has(argument)) {
    return { kind: "locale", locale: argument as "en" | "es" | "pt" };
  }
  const kind = WORDS[head];
  if (!kind) return null;
  switch (kind) {
    case "confirm":
    case "publish":
      return { kind, token: argument && /^\d{4}$/.test(argument) ? argument : null };
    case "pair":
      return argument && /^\d{6}$/.test(argument) ? { kind, code: argument } : null;
    case "review":
      return { kind, index: argument && /^\d{1,2}$/.test(argument) ? Number(argument) : null };
    default:
      return argument === undefined ? ({ kind } as ChatCommand) : null;
  }
}

const AFFIRMATIVE = new Set([
  "yes",
  "y",
  "ok",
  "okay",
  "agree",
  "i agree",
  "sí",
  "si",
  "acepto",
  "de acuerdo",
  "sim",
  "concordo",
  "aceito",
]);

const NEGATIVE = new Set(["no", "n", "no thanks", "no, gracias", "não", "nao", "não, obrigado"]);

/** Plain-language consent answers, used only against an open consent prompt. */
export function consentAnswer(text: string | undefined): "agree" | "decline" | null {
  const normalized = text
    ?.trim()
    .toLowerCase()
    .replace(/[.!]+$/u, "");
  if (!normalized) return null;
  if (AFFIRMATIVE.has(normalized)) return "agree";
  if (NEGATIVE.has(normalized)) return "decline";
  return null;
}
