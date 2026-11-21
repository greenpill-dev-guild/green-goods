import { describe, expect, it } from "vitest";
import { sanitizeModelText } from "../../services/reporting/model-policy";

/** The sanitizer every model-bound text passes through: what it removes and what it must keep. */
describe("model input sanitizer", () => {
  it.each([
    ["call me on +234 800 000 0001 tomorrow", "call me on [phone] tomorrow"],
    ["meu número é (11) 91234-5678", "meu número é [phone]"],
    ["send it to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 please", "send it to [address] please"],
    [`signed 0x${"ab".repeat(65)}`, "signed [address]"],
    ["see https://greengoods.app/agent/reporting/abc123?t=secret now", "see [link] now"],
    ["www.example.org/garden has photos", "[link] has photos"],
    ["escríbeme a josé@example.org", "escríbeme a [email]"],
    ["join at t.me/joinchat/AAAA or greengoods.app/pair?code=abc123", "join at [link] or [link]"],
    ["mi número es 06 12 34 56 78", "mi número es [phone]"],
    ["on 2026-11-21 call 08000000001", "on 2026-11-21 call [phone]"],
    ["2026-11-21 08000000001", "2026-11-21 [phone]"],
    ["photos.example.org?key=secret and my-garden.app", "[link] and [link]"],
    ["I am vitalik.eth and @ada_gardens on Telegram", "I am [account] and [handle] on Telegram"],
    [`token ${"a1B2".repeat(10)} was in the link`, "token [token] was in the link"],
  ])("removes the identifier in %j", (text, expected) => {
    expect(sanitizeModelText(text, 500)).toBe(expected);
  });

  it.each([
    "At TAS today I planted 12 baobab seedlings by the fence. It took 3 hours.",
    "Instalamos 1,5 kW de paneles el 2026-11-21 a las 10:30",
    "Plantamos 1200 mudas em 45 minutos, e 14 no dia 21/11/2026",
    // A date beside a count, a list of counts and a large quantity are not phone numbers.
    "2026-11-21 120 seedlings planted",
    "On 21.11.2026 3 hours of weeding, 8.30-12.30 with 15 people",
    "beds: 10 20 30 40 50\n120\n340\n5600",
    "Planted 1.000.000.000 seeds in rows 3@2.5m apart",
    "three-hundred-and-forty-five-thousand-six-hundred seedlings",
    // A full stop with no space after it is not a link.
    "We cleared the garden.We planted 12 trees.Me and Ada",
  ])("keeps the quantities, dates and words of %j", (story) => {
    expect(sanitizeModelText(story, 500)).toBe(story);
  });

  it("cuts a long text to its bound and marks the cut", () => {
    const cut = sanitizeModelText("seedling ".repeat(100), 40);
    expect(cut).toHaveLength(40);
    expect(cut.endsWith("…")).toBe(true);
  });

  it("removes identifiers before it cuts, so a cut never leaves half of one", () => {
    const text = `${"x".repeat(30)} 0x70997970C51812dc3A010C7d01b50e0d17dc79C8`;
    expect(sanitizeModelText(text, 36)).toBe(`${"x".repeat(30)} [add…`);
  });
});
