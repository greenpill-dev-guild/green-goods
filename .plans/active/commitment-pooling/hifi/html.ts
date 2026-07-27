// Tiny HTML emission helpers shared by the ascii shim and the hi-fi kit.

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const escAttr = (s: string) => esc(s).replace(/"/g, "&quot;");

// Wrap kit-emitted control HTML as a registered hotspot. The inner html must be
// a single element; data-hot lands on it. Used by hi-fi screens (B1+).
export function hot(hid: string, innerHtml: string): string {
  const m = innerHtml.match(/^(\s*<[a-z][a-z0-9-]*)([\s>])/i);
  if (!m) throw new Error(`hot(${hid}): inner html must start with an element tag`);
  return innerHtml.replace(m[0], `${m[1]} data-hot="${escAttr(hid)}"${m[2] === ">" ? ">" : " "}`);
}

// Wrap arbitrary html as a markable region (journey "look here" highlight).
export function mark(mid: string, innerHtml: string): string {
  return `<span data-mark="${escAttr(mid)}">${innerHtml}</span>`;
}
