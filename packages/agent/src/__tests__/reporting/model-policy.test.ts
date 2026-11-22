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
    ["call 08000000001 09000000002 today", "call [phone] [phone] today"],
    // A count, a date or another number beside a phone number does not vouch for it.
    ["my number is 5551234567. 20 trees planted", "my number is [phone]. 20 trees planted"],
    ["5551234567 20 trees", "[phone] 20 trees"],
    ["Meu número é 11 91234-5678. 20 árvores", "Meu número é [phone]. 20 árvores"],
    ["11 91234-5678 21/11/2026", "[phone] 21/11/2026"],
    ["+44-20-7946-0958 or 0044-20-7946-0958", "[phone] or [phone]"],
    ["555 123 4567 555 987 6543", "[phone]"],
    ["20 5551234567 and 98765 43210", "20 [phone] and [phone]"],
    ["tel.5551234567 ou +55 11 91234\u20115678", "tel.[phone] ou [phone]"],
    // Dotted groups and pairs are how Spanish, Portuguese and Mexican numbers are written.
    [
      "Sembramos 30 árboles hoy. Mi número es +34 612.345.678",
      "Sembramos 30 árboles hoy. Mi número es [phone]",
    ],
    [
      "Plantámos 20 árvores, o meu número é 912.345.678",
      "Plantámos 20 árvores, o meu número é [phone]",
    ],
    ["0034 612.345.678 / +34.612.345.678 / 612 345.678", "[phone] / [phone] / [phone]"],
    ["11 912.345.678, 8031 234.567, +44 (7700) 900.123", "[phone], [phone], [phone]"],
    ["ligar 11 91234-5678,20 mudas plantadas", "ligar [phone],20 mudas plantadas"],
    ["0803 123 4567.20 trees", "[phone] trees"],
    ["mi cel es 55 12 34 56 78", "mi cel es [phone]"],
    ["55-12-34-56-78 o 55.12.34.56.78", "[phone] o [phone]"],
    ["81 12 34 56 78 y trabajamos 3 horas", "[phone] y trabajamos 3 horas"],
    // No-break spaces, as contacts apps and French grouping write them, and other separators.
    ["ligue 0803\u00a0123\u00a04567", "ligue [phone]"],
    ["+33\u00a06\u00a012\u00a034\u00a056\u00a078 et 612\u202f345\u202f678", "[phone] et [phone]"],
    ["(555)-123-4567, +1 (555)-123-4567, (020)-7946-0958", "[phone], [phone], [phone]"],
    ["555/123-4567 or 0803  123  4567 or 0803\t123\t4567", "[phone] or [phone] or [phone]"],
    [
      "IG: @joao.silva_horta, fala com @ada_gardens.Ela plantou",
      "IG: [handle], fala com [handle].Ela plantou",
    ],
    ["ligue 0803\u2009123\u20094567", "ligue [phone]"],
    // What is written onto a number or around a date is not left behind.
    ["+234(0)8031234567", "[phone]"],
    ["(12/03/2026) 0803 123 4567", "(12/03/2026) [phone]"],
    ["0803 123 4567 (12/03/2026)", "[phone] (12/03/2026)"],
    // Where a row of digits could be either, it is removed: the limits the policy states.
    ["beds: 10 20 30 40 50", "beds: [phone]"],
    ["Planted 1.000.000.000 seeds", "Planted [phone] seeds"],
    ["photos.example.org?key=secret and my-garden.app", "[link] and [link]"],
    ["GREENGOODS.APP/PAIR?CODE=ABC123 or Greengoods.App/pair?code=abc123", "[link] or [link]"],
    [
      "see Example.Com or greengoods.app:443/agent/reporting/abc123?t=secret",
      "see [link] or [link]",
    ],
    ["user:secret@example.org/x", "[link]"],
    ["PHOTOS.EXAMPLE.ORG/private?token=secret", "[link]"],
    ["photos.example.org:8443/private?token=secret", "[link]"],
    ["Photos.Example.Mx/private?token=secret", "[link]"],
    ["PHOTOS.EXAMPLE.MX/private/token or PHOTOS.EXAMPLE.CO.UK/private/token", "[link] or [link]"],
    ["I am vitalik.eth and @ada_gardens on Telegram", "I am [account] and [handle] on Telegram"],
    ["sou joão.eth, garden 0x7099…79C8", "sou [account], garden [address]"],
    [`token ${"a1B2".repeat(10)} was in the link`, "token [token] was in the link"],
  ])("removes the identifier in %j", (text, expected) => {
    expect(sanitizeModelText(text, 500)).toBe(expected);
  });

  it.each([
    "At TAS today I planted 12 baobab seedlings by the fence. It took 3 hours.",
    "Instalamos 1,5 kW de paneles el 2026-11-21 a las 10:30",
    "Plantamos 1200 mudas em 45 minutos, e 14 no dia 21/11/2026",
    // A period of work written with no spaces is two dates, not a phone number.
    "de 21/11/2026-25/11/2026, 2026-11-21/2026-11-25, 21/11/26-25/11/26 e 11/2026-12/2026",
    // A date beside a count, a list of counts and a large quantity are not phone numbers.
    "2026-11-21 120 seedlings planted",
    "On 21.11.2026 3 hours of weeding, 8.30-12.30 with 15 people",
    "beds: 10 20 30 40\n120\n340\n5600",
    "Planted 1.250.000 seeds in rows 3@2.5m apart, area 2000-10000 m²",
    "Years 2024 2025 2026, shares 0.25 0.50 0.75 1.00, rows 0 1 2 3 4 5 6 7",
    // A full stop with no space after it, in Portuguese and Spanish, is not a link.
    "Plantamos 20 mudas.Certo? Sembramos 30 árboles.Bien? Pronto.Ok?",
    "1.Plantio/rega 2.Colheita, compostagem.Rega/poda feitas, Sr.Silva/Sra.Souza",
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
    expect(sanitizeModelText(text, 36)).toBe(`${"x".repeat(30)}…`);
    // A text cut before it is matched loses the word the cut left in half.
    const long = `${"https://example.org/a ".repeat(40)}joao.silva@example.org`;
    expect(sanitizeModelText(long.slice(0, 890), 440)).not.toMatch(/joao|silva/u);
    // A phone number written in groups across the cut goes whole, not only its last group.
    const grouped = `https://example.org/${"a".repeat(968)} +234 800 000 0001`;
    expect(sanitizeModelText(grouped, 500)).not.toMatch(/234|800/u);
    // A first cut through an emoji leaves no half of it, even when redaction then shortens the text.
    expect(sanitizeModelText(`0x${"a".repeat(79)}${"🌱".repeat(20)}`, 50)).not.toMatch(
      /[\ud800-\udbff](?![\udc00-\udfff])/u
    );
    // A redaction that shortens the text does not bring the cut word into the result.
    const shortened = `t.me/${"a".repeat(1979)} alice@example.com`;
    expect(sanitizeModelText(shortened, 500)).not.toMatch(/alice|example/u);
    expect(sanitizeModelText(`${"ก".repeat(990)}alice@example.com`, 500)).not.toMatch(/alice/u);
  });

  it("cuts text with no spaces, and never through a character written as a pair", () => {
    expect(sanitizeModelText("ต้นกล้า".repeat(60), 160)).toHaveLength(160);
    const cut = sanitizeModelText(`${"a".repeat(38)}🌱🌱🌱 and more`, 40);
    expect(cut).toBe(`${"a".repeat(38)}…`);
  });
});
