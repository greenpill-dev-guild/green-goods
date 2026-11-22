import { Confidence } from "@green-goods/shared/types/domain";

/**
 * Reads a steward's decision, confidence and feedback out of one answer, with no model. A decision
 * or a confidence is taken only from a phrase that says nothing else ("Approve.", "I reject this
 * work", "Actually reject", "high confidence", "confianza alta"), and never from a sentence that
 * asks, doubts, or goes on with a condition or a "no" ("Approve, if the photos are fixed",
 * "Aprobar no, faltan fotos"). Praise, thanks and "looks good" decide nothing, an answer that says
 * both approve and reject decides nothing, and two different levels settle neither. What is left,
 * in the steward's own words, is the feedback.
 */
export interface ReviewReading {
  decision?: "approve" | "reject";
  confidence?: Confidence;
  feedback?: string;
}

type Asked = "decision" | "confidence" | "feedback" | null;

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();

const APPROVE = "approve|approved|aprobar|apruebo|aprobado|aprovar|aprovo|aprovado";
const REJECT = "reject|rejected|rechazar|rechazo|rechazado|rejeitar|rejeito|rejeitado";
const OBJECT = "(?: (?:this work|the work|it|this|el trabajo|esto|o trabalho|isto))?";
/** Words that open a change of mind. "No" is not one: "no apruebo" refuses, it does not approve. */
const LEAD_IN =
  "(?:(?:actually|sorry|correction|en realidad|perdon|mejor|na verdade|desculpe|melhor) )?";
const SAYS_APPROVE = new RegExp(`(?<![\\p{L}])(?:${APPROVE})(?![\\p{L}])`, "u");
const SAYS_REJECT = new RegExp(`(?<![\\p{L}])(?:${REJECT})(?![\\p{L}])`, "u");

const LEVELS: ReadonlyArray<readonly [Confidence, string]> = [
  [Confidence.LOW, "low|baja|baixa"],
  [Confidence.MEDIUM, "medium|media"],
  [Confidence.HIGH, "high|alta"],
];
const LEVEL = LEVELS.map(([, words]) => words).join("|");
const NOUN = "confidence|confianza|confianca";
/** "high confidence", "with high confidence", "confidence: high", "con confianza alta". */
const PHRASE = `(?:(?:with |con |com )?(?:(?:${LEVEL}) (?:${NOUN})|(?:${NOUN})(?: is| es| e)? (?:${LEVEL})))`;
/** A phrase that states a decision, a confidence, or both, and nothing else. */
const STATED = new RegExp(
  `^(?:${LEAD_IN}(?:i |yo |eu )?(?:(${APPROVE})|(${REJECT}))${OBJECT}(?: (${PHRASE}))?|(${PHRASE}))$`,
  "u"
);
const BARE_LEVEL = new RegExp(`^(?:${LEVEL})$`, "u");
const LEVEL_WORD = new RegExp(`(?:^| )(${LEVEL})(?: |$)`, "u");
/**
 * Words that, opening a later part of the decision's own sentence, make it conditional or
 * uncertain: "Approve, if the photos are fixed", "Approve, I think". Later sentences are feedback:
 * "Reject. The photos are probably from another garden." gives its reason.
 */
const CONDITION =
  /^(?:if|unless|once|when|until|except|only if|provided|as long as|assuming|pending|depending|se|cuando|quando|hasta|ate|salvo|excepto|exceto|solo si|so se|a menos|siempre que|desde que|contanto que|con tal|a condicion|maybe|perhaps|probably|i think|i guess|i suppose|i believe|creo|acho|supongo|acredito|not sure|no estoy|tal vez|talvez|quizas|quiza)(?= |$)/u;
/** A doubt anywhere in a later part of the decision's own sentence: "high, but I'm not sure". */
const DOUBT = /(?:^| )(?:not sure|unsure|no estoy segur[oa]|nao tenho certeza|nao sei)(?: |$)/u;
/** "si" is "if"; "sí" is "yes", so it is told apart before accents are folded. */
const IF_SI = /^si(?=[\s,]|$)/u;
/** A contrast then a "no" in the decision's own sentence: "Approve, but not yet", "Aprobar, aunque no". */
const BUT_NOT =
  /(?:^| )(?:but|pero|mas|though|although|aunque|porem|embora|however)(?: \p{L}+){0,2} (?:no|not|nao)(?: |$)/u;
/**
 * A part made only of these words, anywhere after a decision, takes it back: "Not yet.", "Actually
 * no.", "Never mind.", "Mejor no.", "Not sure." It must hold one of the `RETRACTS` words.
 */
const TAKE_BACK_WORDS = new Set(
  (
    "actually no not nope nah never nunca nao yet todavia aun ainda now wait espera hold on mind " +
    "scratch that really way just kidding es broma brincadeira i im m am changed my mejor melhor " +
    "or o ou sure unsure seguro segura estoy tenho tengo certeza maybe perhaps probably tal vez " +
    "talvez quizas quiza sorry"
  ).split(" ")
);
const RETRACTS =
  /(?:^| )(?:no|not|nope|nah|never|nunca|nao|wait|espera|hold|mind|scratch|kidding|broma|brincadeira|unsure|maybe|perhaps|probably|vez|talvez|quizas|quiza)(?: |$)/u;
const takesBack = (words: string) =>
  words !== "" &&
  words.split(" ").every((word) => TAKE_BACK_WORDS.has(word)) &&
  RETRACTS.test(words);
/** Marks that undo an approval or a level beside them: a thumbs down, a cross, a thinking face. */
const UNDONE = /[\u{1F44E}\u{1F914}\u{274C}\u{1F6AB}\u{26D4}]/u;
/** WhatsApp's strikethrough around the decision itself: "~Approve~". */
const STRUCK = /~/u;

const levelOf = (words: string): Confidence | undefined =>
  LEVELS.find(([, names]) => names.split("|").includes(words))?.[0];

/** Letters and digits only: punctuation, emoji and symbols say nothing here. */
const plainOf = (text: string) =>
  fold(text)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

type Span = readonly [number, number];

const OPENS_APPROVE = new RegExp(`^${LEAD_IN}(?:i |yo |eu )?(?:${APPROVE})(?= |$)`, "u");
const OPENS_REJECT = new RegExp(`^${LEAD_IN}(?:i |yo |eu )?(?:${REJECT})(?= |$)`, "u");

/**
 * The decision an answer opens with, whether or not it could be read as one: "Reject? Not sure
 * yet." opens with a rejection. A reason that only mentions one ("No puedo aprobar sin fotos")
 * opens with none.
 */
export function openingDecision(text: string): "approve" | "reject" | null {
  const opening = plainOf(partsOf(text)[0]?.raw ?? "");
  if (OPENS_APPROVE.test(opening)) return "approve";
  if (OPENS_REJECT.test(opening)) return "reject";
  return null;
}

/**
 * The answer with what was read taken out, with the punctuation and one line's space that closed
 * it, so the words on either side keep their own spacing.
 */
function without(text: string, spans: Span[]): string {
  let kept = "";
  let at = 0;
  for (const [start, end] of [...spans].sort((a, b) => a[0] - b[0])) {
    kept += text.slice(at, Math.max(at, start));
    at = Math.max(at, end + (/^[,.;:!]*[ \t]*\n?/u.exec(text.slice(end))?.[0].length ?? 0));
  }
  kept += text.slice(at);
  return kept.replace(/^[\s,.;:!]+|[\s,;:]+$/gu, "");
}

interface Part {
  words: string;
  raw: string;
  sentence: number;
  asks: boolean;
  span: Span;
}

/** Sentences, split at their commas, each part with where it stands in the answer. */
function partsOf(text: string): Part[] {
  return [...text.matchAll(/[^.;!?\n]+/gu)].flatMap((sentence, index) => {
    const from = sentence.index;
    const asks = text[from + sentence[0].length] === "?";
    return [...sentence[0].matchAll(/[^,]+/gu)].flatMap((part) => {
      const raw = part[0].trim();
      if (!raw) return [];
      const start = from + part.index + (part[0].length - part[0].trimStart().length);
      return [
        { words: plainOf(raw), raw, sentence: index, asks, span: [start, start + raw.length] },
      ];
    });
  });
}

export function readReviewAnswer(text: string, asked: Asked): ReviewReading {
  const parts = partsOf(text);
  // A part in a sentence that asks states nothing: "Approve?" and "High confidence?" are questions.
  const stated = parts.map((part) => (part.asks ? null : STATED.exec(part.words)));
  const bareAt = parts.map((part) =>
    !part.asks && BARE_LEVEL.test(part.words) ? levelOf(part.words) : undefined
  );
  const first = parts.findIndex((_, index) => stated[index] || bareAt[index] !== undefined);
  const readHere = (index: number) => stated[index] || bareAt[index] !== undefined;
  const decisionsIn = new Set(
    stated.flatMap((match) => (match?.[1] ? ["approve"] : match?.[2] ? ["reject"] : []))
  );
  // What follows a decision or a level can take it back: a part made only of take-back words in any
  // later sentence ("Approve. Not yet."), a mark that undoes it, or, in its own sentence, a
  // condition, a doubt or a contrast with a "no" ("Approve, if the photos are fixed").
  const takenBack =
    first >= 0 &&
    parts.some((part, index) => {
      if (index < first) return false;
      // A cross beside a rejection agrees with it; beside an approval or a level it undoes it.
      if (UNDONE.test(part.raw) && !decisionsIn.has("reject")) return true;
      if (index === first && STRUCK.test(part.raw)) return true;
      if (index === first) return false;
      const sameSentence = parts.some(
        (before, at) => at < index && readHere(at) && before.sentence === part.sentence
      );
      return (
        takesBack(part.words) ||
        (sameSentence &&
          (CONDITION.test(part.words) ||
            DOUBT.test(part.words) ||
            BUT_NOT.test(part.words) ||
            IF_SI.test(part.raw.normalize("NFC").toLowerCase())))
      );
    });
  const decisions = new Set<"approve" | "reject">();
  const levels = new Set<Confidence>();
  const read: Span[] = [];
  if (!takenBack)
    parts.forEach((part, index) => {
      const match = stated[index];
      if (!match) return;
      if (match[1]) decisions.add("approve");
      else if (match[2]) decisions.add("reject");
      const phrase = match[3] ?? match[4];
      const level = phrase ? levelOf(LEVEL_WORD.exec(phrase)?.[1] ?? "") : undefined;
      if (level !== undefined) levels.add(level);
      read.push(part.span);
    });
  const reading: ReviewReading = {};
  if (decisions.size === 1) reading.decision = [...decisions][0] as "approve" | "reject";
  // A level on its own ("High.") is a confidence when that was asked, or beside a decision.
  if (!takenBack && (asked === "confidence" || reading.decision))
    bareAt.forEach((level, index) => {
      if (level === undefined) return;
      levels.add(level);
      read.push((parts[index] as Part).span);
    });
  // Two different levels settle neither.
  if (levels.size === 1) reading.confidence = [...levels][0] as Confidence;
  const feedback = without(text, read);
  // What is left is feedback when feedback was asked, or when it comes with a decision.
  if (feedback && (asked === "feedback" || reading.decision)) reading.feedback = feedback;
  // An answer that names both decisions anywhere, as "Approve. Actually reject." does, settles
  // neither: the question is asked again.
  const plain = fold(text);
  return SAYS_APPROVE.test(plain) && SAYS_REJECT.test(plain) ? {} : reading;
}
