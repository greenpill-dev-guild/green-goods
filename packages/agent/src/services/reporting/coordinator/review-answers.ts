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
/** Words that, opening a later part of the same sentence, make what it stated conditional or refused. */
const HEDGE =
  /^(?:no|not|nao|never|nunca|yet|todavia|ainda|if|unless|once|when|until|after|except|only|se|cuando|quando|hasta|ate|salvo|excepto|exceto|solo|a menos|or|o|ou|provided|as long as|siempre que|desde que|contanto que|con tal|i think|i guess|creo|acho)(?= |$)/u;
/** "si" is "if"; "sí" is "yes", so it is told apart before accents are folded. */
const IF_SI = /^si(?=[\s,]|$)/u;
/** Said after a decision in any later sentence or line, these take it back: "Approve. Not yet." */
const TAKEN_BACK =
  /^(?:(?:no|not|nope|nao)$|(?:not yet|not now|todavia no|aun no|ainda nao|wait|espera|just kidding|es broma|brincadeira|if|unless|provided|as long as|only if|siempre que|desde que|contanto que|solo si|so se)(?: |$))/u;
const BUT_NOT = /(?:^| )(?:but|pero|mas) (?:no|not|nao)(?: |$)/u;
/** Anywhere in the answer, a doubt leaves every decision and level to be asked. */
const DOUBT =
  /(?:^| )(?:not sure|unsure|no estoy segur[oa]|no se|nao sei|nao tenho certeza|maybe|perhaps|probably|i guess|tal vez|talvez|quizas|quiza)(?: |$)/u;

const levelOf = (words: string): Confidence | undefined =>
  LEVELS.find(([, names]) => names.split("|").includes(words))?.[0];

/** Letters and digits only: punctuation, emoji and symbols say nothing here. */
const plainOf = (text: string) =>
  fold(text)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

type Span = readonly [number, number];

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
  // What a later part says can take back everything stated before it: a doubt anywhere, "not yet"
  // or "wait" in a later sentence, "but not", or a condition or a "no" later in the same sentence.
  const takenBack =
    first >= 0 &&
    (DOUBT.test(plainOf(text)) ||
      parts.some(
        (part, index) =>
          index > first &&
          (TAKEN_BACK.test(part.words) ||
            BUT_NOT.test(part.words) ||
            ((HEDGE.test(part.words) || IF_SI.test(part.raw.normalize("NFC").toLowerCase())) &&
              parts.some(
                (before, at) => at < index && stated[at] && before.sentence === part.sentence
              )))
      ));
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
