import type { Address } from "@green-goods/shared/types/domain";

/**
 * Deterministic chat commands. They work with every model disabled and take precedence over
 * interpretation, so STOP, DELETE and HELP can never be misread as report content. An account
 * address sent on its own is a command too: it asks to link that account, and proves nothing.
 * A short message that is nothing but a request to log in, log out or switch account is read as
 * that command as well, so linking never depends on knowing the command word.
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
  | { kind: "connect"; account: Address | null }
  | { kind: "disconnect" }
  | { kind: "switch" }
  | { kind: "garden" }
  | { kind: "join" }
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
  connect: "connect",
  conectar: "connect",
  link: "connect",
  vincular: "connect",
  login: "connect",
  signin: "connect",
  disconnect: "disconnect",
  desconectar: "disconnect",
  unlink: "disconnect",
  desvincular: "disconnect",
  logout: "disconnect",
  signout: "disconnect",
  switch: "switch",
  reconnect: "switch",
  reconectar: "switch",
  garden: "garden",
  gardens: "garden",
  huerto: "garden",
  huertos: "garden",
  horta: "garden",
  hortas: "garden",
  join: "join",
  unirme: "join",
  participar: "join",
  review: "review",
  revisar: "review",
};

/** Marks the reply ID of a button that sends a command instead of answering the open question. */
const COMMAND_REPLY = "cmd:";

/**
 * The reply ID for a button that stands for a command word. Such a button stays good after the
 * conversation has moved on to another question, which a choice of one question does not.
 */
export function commandReplyId(word: string): string {
  return `${COMMAND_REPLY}${word}`;
}

/** The command a tapped command button stands for; null for any other reply. */
export function replyCommand(replyId: string | undefined): ChatCommand | null {
  return replyId?.startsWith(COMMAND_REPLY)
    ? parseCommand(replyId.slice(COMMAND_REPLY.length))
    : null;
}

const LOCALES = new Set(["en", "es", "pt"]);
const ACCOUNT = /^0x[0-9a-f]{40}$/;
const isAccount = (word: string | undefined): word is Address =>
  word !== undefined && ACCOUNT.test(word);

/** The longest message read as an account request; anything longer is a story for the report. */
const MAX_REQUEST_WORDS = 9;

/** Words that may surround an account request without making the message about anything else. */
const REQUEST_FILLER = new Set(
  `i id i'd would like to want wanna need can could may please pls how do let me help my the a an
   account wallet passkey with into in on of first now again green goods greengoods and then hi
   hello hey this chat bot here out quiero quisiera gustaria gustaría puedo necesito como cómo mi
   cuenta billetera con la el de por favor primero quero gostaria posso preciso minha conta
   carteira na no em uma um una un sesion sesión sessao sessão`.split(/\s+/u)
);

const OTHER_ACCOUNT = /\b(another|different|other|new|otra|otro|nueva|outra|outro|nova)\b/u;
const ACCOUNT_NOUN = /\b(account|wallet|passkey|cuenta|billetera|conta|carteira)\b/u;

const ACCOUNT_REQUESTS: Array<{ kind: "disconnect" | "switch" | "connect"; phrase: RegExp }> = [
  {
    kind: "disconnect",
    phrase:
      /\b(log (me )?out|logout|sign (me )?out|signout|disconnect|unlink|cerrar sesi[oó]n|desconectar|desvincular|encerrar sess[aã]o|sair da conta)\b/u,
  },
  {
    kind: "switch",
    phrase: /\b(switch|change|reconnect|use|cambiar|usar|trocar|mudar|reconectar)\b/u,
  },
  {
    kind: "connect",
    phrase:
      /\b(log (me )?in|login|sign (me )?in|signin|connect|link|iniciar sesi[oó]n|iniciar sess[aã]o|conectar|vincular|entrar|acceder|acessar|fazer login)\b/u,
  },
];

/**
 * A short message that asks for nothing but an account action: "I would like to log in",
 * "sign me out", "connect another account". Every other word has to be filler, so a story that
 * happens to say "connect" or "log" still reaches the report.
 */
function accountRequest(text: string): ChatCommand | null {
  const said = text.replace(/[.,!?¿¡]+/gu, " ").trim();
  const words = said.split(/\s+/u);
  if (words.length > MAX_REQUEST_WORDS) return null;
  for (const { kind, phrase } of ACCOUNT_REQUESTS) {
    const match = phrase.exec(said);
    if (!match) continue;
    const rest = `${said.slice(0, match.index)} ${said.slice(match.index + match[0].length)}`;
    const other = OTHER_ACCOUNT.test(rest);
    const plain = rest
      .replace(OTHER_ACCOUNT, " ")
      .split(/\s+/u)
      .filter(Boolean)
      .every((word) => REQUEST_FILLER.has(word));
    if (!plain) return null;
    // "Change" and "use" say nothing about accounts on their own: "I want to change this" is about
    // the report. They are an account request only when the message names an account.
    if (kind === "switch" && !ACCOUNT_NOUN.test(rest)) return null;
    // Linking, or using, "another" account is a switch; using "my" account is only linking.
    if (kind === "connect" || (/^(use|usar)$/u.test(match[0]) && !other))
      return other ? { kind: "switch" } : { kind: "connect", account: null };
    return { kind };
  }
  return null;
}

const GREETING_WORDS = new Set(
  `hi hello hey heya hiya yo howdy greetings gm good morning afternoon evening day there hola
   buenas buenos dias días tardes noches saludos ola olá oi bom boa dia tarde noite`.split(/\s+/u)
);

/** A message that only says hello. It describes no work, so it never starts a report. */
export function isGreeting(text: string | null | undefined): boolean {
  const words = (text ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\s]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  return words.length > 0 && words.length <= 4 && words.every((word) => GREETING_WORDS.has(word));
}

export function parseCommand(text: string | undefined): ChatCommand | null {
  if (!text) return null;
  const said = text.trim().toLowerCase();
  const words = said.split(/\s+/u);
  if (words.length === 0) return null;
  return commandWord(words) ?? accountRequest(said);
}

function commandWord(words: string[]): ChatCommand | null {
  if (words.length > 2) return null;
  const [head, argument] = words;
  if ((head === "lang" || head === "idioma") && argument && LOCALES.has(argument)) {
    return { kind: "locale", locale: argument as "en" | "es" | "pt" };
  }
  if (isAccount(head)) return argument === undefined ? { kind: "connect", account: head } : null;
  const kind = WORDS[head];
  if (!kind) return null;
  switch (kind) {
    case "confirm":
    case "publish":
      return { kind, token: argument && /^\d{4}$/.test(argument) ? argument : null };
    case "pair":
      return argument && /^\d{6}$/.test(argument) ? { kind, code: argument } : null;
    case "connect":
      if (argument === undefined) return { kind, account: null };
      return isAccount(argument) ? { kind, account: argument } : null;
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

/** A plain-language yes or no, read only against an open question that takes one. */
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
