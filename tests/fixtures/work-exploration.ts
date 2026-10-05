/** A bounded read-only action plan. The seed, not wall time, owns every variation. */
export function workExplorationCases(seedText = "17") {
  if (!/^[1-9]\d*$/.test(seedText) || Number(seedText) > 0xffffffff) {
    throw new Error("Exploration seed must be an integer from 1 to 4294967295");
  }
  let state = Number(seedText);
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  return [false, true].map((recovery) => ({
    seed: seedText,
    now: "2026-10-05T12:00:00Z",
    recovery,
    role: (next() % 2 ? "steward" : "user") as "steward" | "user",
    viewport: { width: [390, 768, 1280][next() % 3], height: 844 },
    feedback: `${1 + (next() % 99)} native trees planted — café 🌱 ${seedText}`,
    actions: ["open", ...(recovery ? ["recover"] : []), "inspect", "reload"] as string[],
  }));
}

export function assertExplorationNavigation(url: string, origin: string, pathname: string) {
  const actual = new URL(url);
  if (actual.origin !== origin || actual.pathname !== pathname) {
    throw new Error(`Out-of-scope exploration navigation: ${actual.origin}${actual.pathname}`);
  }
}
