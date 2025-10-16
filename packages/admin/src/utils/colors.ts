export function hashStringToNumber(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function hueFromHash(hash: number, offset = 0) {
  return (hash * 37 + offset) % 360;
}

export function gradientForSeed(seed: string) {
  const hash = hashStringToNumber(seed);
  const hueA = hueFromHash(hash);
  const hueB = hueFromHash(hash, 90);
  const hueC = hueFromHash(hash, 180);

  return `linear-gradient(135deg, hsl(${hueA} 70% 55%), hsl(${hueB} 70% 50%), hsl(${hueC} 70% 45%))`;
}
