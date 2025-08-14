export type Lang = "en" | "es" | "pt";
export const detectLang = (s: string): Lang => {
  const t = s.normalize("NFKD").toLowerCase();
  if (/[áéíóúñ¿¡]/.test(t) || /\b(el|la|los|las|de|y|que|para|con)\b/.test(t)) return "es";
  if (/[ãõçáéíóú]/.test(t) || /\b(o|a|os|as|de|que|para|com|e)\b/.test(t)) return "pt";
  return "en";
};
