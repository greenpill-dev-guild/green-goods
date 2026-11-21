// Scoring for the encoder measurement: keyword (BM25), encoder (cosine), and both fused by
// reciprocal rank. Pure functions, so the extension page and Node compute identical numbers.

const STOPWORDS = new Set(
  (
    "a an and are as at be been but by can could did do does for from had has have how if in into is it its " +
    "may might must not of on or our over should so such than that the their them then there these they this " +
    "those to under up was we were what when where which while who will with would you your"
  ).split(" "),
);

function keywordTokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

// Okapi BM25 with the usual k1 = 1.2 and b = 0.75; one row per query, one column per document.
export function bm25Scores(queries: string[], documents: string[], k1 = 1.2, b = 0.75): number[][] {
  const docTokens = documents.map(keywordTokens);
  const averageLength = docTokens.reduce((sum, tokens) => sum + tokens.length, 0) / Math.max(docTokens.length, 1);
  const termCounts = docTokens.map((tokens) => {
    const counts = new Map<string, number>();
    for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
    return counts;
  });
  const documentFrequency = new Map<string, number>();
  for (const counts of termCounts) for (const term of counts.keys()) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  const n = documents.length;
  const idf = (term: string) => {
    const df = documentFrequency.get(term) ?? 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  };
  return queries.map((query) => {
    const terms = [...new Set(keywordTokens(query))];
    return termCounts.map((counts, index) => {
      const length = docTokens[index]?.length ?? 0;
      let score = 0;
      for (const term of terms) {
        const tf = counts.get(term) ?? 0;
        if (tf === 0) continue;
        score += (idf(term) * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * length) / averageLength));
      }
      return score;
    });
  });
}

// Vectors arrive L2-normalized, so the dot product is the cosine.
function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function cosineScores(queries: ArrayLike<number>[], documents: ArrayLike<number>[]): number[][] {
  return queries.map((query) => documents.map((document) => cosine(query, document)));
}

// 1-based position of each document in a row, best first. An exact tie is settled by `tieBreak`
// (a second score per document) when one is given; a tie that remains shares the worse position, so
// a scorer that cannot separate two documents never gets credit for the right one.
export function positions(row: number[], tieBreak?: number[]): number[] {
  const tieAbove = (j: number, index: number) => j !== index && !(tieBreak && (tieBreak[index] ?? 0) > (tieBreak[j] ?? 0));
  return row.map((score, index) => 1 + row.filter((other, j) => other > score || (other === score && tieAbove(j, index))).length);
}

// Reciprocal rank fusion (k = 60) of two scorers over the same documents. Two documents whose ranks
// are swapped between the scorers (first and second, second and first) score exactly the same, so
// summarize fused scores with a tie-break.
export function fusedScores(first: number[][], second: number[][], k = 60): number[][] {
  return first.map((row, q) => {
    const a = positions(row);
    const b = positions(second[q] ?? []);
    return a.map((position, d) => 1 / (k + position) + 1 / (k + (b[d] ?? Number.POSITIVE_INFINITY)));
  });
}

export interface RankingSummary {
  requirements: number;
  top1: number;
  top3: number;
  top1Share: number;
  top3Share: number;
  positions: number[];
}

export function summarize(scores: number[][], correctIndex: number[], tieBreak?: number[][]): RankingSummary {
  const found = scores.map((row, q) => positions(row, tieBreak?.[q])[correctIndex[q] ?? -1] ?? Number.POSITIVE_INFINITY);
  const top1 = found.filter((position) => position === 1).length;
  const top3 = found.filter((position) => position <= 3).length;
  return { requirements: found.length, top1, top3, top1Share: top1 / found.length, top3Share: top3 / found.length, positions: found };
}

export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((x, y) => x - y);
  if (sorted.length === 0) return Number.NaN;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? Number.NaN;
}
