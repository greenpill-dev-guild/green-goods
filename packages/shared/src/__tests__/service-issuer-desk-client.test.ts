import { describe, expect, it, vi } from "vitest";
import { createServiceIssuerDeskClient } from "../modules/commitment-pooling/service-issuer-desk-client";
import {
  encodeServiceIssuerDesk,
  serviceIssuerDeskMessage,
  parseServiceIssuerDraft,
} from "../modules/commitment-pooling/service-issuer-desk-protocol";
import { issuerDeskFixture } from "./fixtures/issuer-desk";

function fixture() {
  const record = issuerDeskFixture();
  const sign = vi.fn(async () => "0x1234" as const);
  const assertCurrent = vi.fn();
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
    Response.json({ ok: true, payload: encodeServiceIssuerDesk({ ok: true, record }) })
  );
  const client = createServiceIssuerDeskClient({
    account: record.draft.member,
    sign,
    assertCurrent,
    fetch,
    baseUrl: "https://agent.example",
    audience: "https://greengoods.app",
    now: () => 1_800_000_000_000,
  });
  return { record, sign, assertCurrent, fetch, client };
}
describe("issuer desk transport", () => {
  it("preserves narrative line breaks while rejecting controls and multiline identity or references", () => {
    const draft = issuerDeskFixture().draft;
    const service = {
      ...draft.terms.service,
      buys: "Logo design\nIncludes two revisions",
      scope: "Initial concept\r\nFinal artwork",
      remedy: "Contact the designer\rAgree a revised delivery",
    };
    const multiline = { ...draft, terms: { ...draft.terms, service } };
    expect(parseServiceIssuerDraft(multiline).terms.service).toEqual(service);
    for (const field of ["buys", "scope", "remedy"] as const) {
      expect(() =>
        parseServiceIssuerDraft({
          ...multiline,
          terms: { ...multiline.terms, service: { ...service, [field]: "Text\twith a tab" } },
        })
      ).toThrow("Invalid desk text");
    }
    expect(() => parseServiceIssuerDraft({ ...multiline, memberName: "Maya\nDesigner" })).toThrow(
      "Invalid desk text"
    );
    expect(() =>
      parseServiceIssuerDraft({
        ...multiline,
        terms: { ...multiline.terms, service: { ...service, title: "Logo\nDesign" } },
      })
    ).toThrow("Invalid desk text");
    expect(() =>
      parseServiceIssuerDraft({
        ...multiline,
        terms: {
          ...multiline.terms,
          document: { ...draft.terms.document, reference: "https://example.com/\nterms" },
        },
      })
    ).toThrow("Invalid draft references");
  });
  it("refuses terms the configured member deployment cannot honor", () => {
    const draft = issuerDeskFixture().draft;
    expect(() =>
      parseServiceIssuerDraft({
        ...draft,
        terms: { ...draft.terms, token: { ...draft.terms.token, name: " Design vouchers " } },
      })
    ).toThrow();
    expect(() =>
      parseServiceIssuerDraft({
        ...draft,
        terms: { ...draft.terms, service: { ...draft.terms.service, unit: " session " } },
      })
    ).toThrow();
    expect(() =>
      parseServiceIssuerDraft({ ...draft, terms: { ...draft.terms, poolFee: 1_000_001n } })
    ).toThrow();
    expect(() =>
      parseServiceIssuerDraft({
        ...draft,
        terms: { ...draft.terms, token: { ...draft.terms.token, decimals: 18 } },
      })
    ).toThrow();
    expect(() =>
      parseServiceIssuerDraft({
        ...draft,
        terms: { ...draft.terms, token: { ...draft.terms.token, symbol: "lowercase" } },
      })
    ).toThrow();
    expect(() =>
      parseServiceIssuerDraft({
        ...draft,
        terms: { ...draft.terms, issue: { ...draft.terms.issue, pool: 0n } },
      })
    ).toThrow();
    expect(
      parseServiceIssuerDraft({
        ...draft,
        terms: { ...draft.terms, poolFee: 1_000_000n, rewardAllowance: 100_000_000n },
      })
    ).toMatchObject({ terms: { poolFee: 1_000_000n } });
  });
  it("signs the exact serialized action including bigint terms and caches only identical reads", async () => {
    const f = fixture();
    const command = { action: "read" as const, id: f.record.draft.id };
    expect((await f.client.request(command)).record).toEqual(f.record);
    const { signature: _, ...proof } = JSON.parse(f.fetch.mock.calls[0][1]!.body as string);
    expect(f.sign).toHaveBeenCalledWith(serviceIssuerDeskMessage(proof));
    await f.client.request(command);
    expect(f.sign).toHaveBeenCalledOnce();
    await f.client.request({ action: "send", id: f.record.draft.id, expectedRevision: 1 });
    await f.client.request({ action: "send", id: f.record.draft.id, expectedRevision: 1 });
    expect(f.sign).toHaveBeenCalledTimes(3);
  });
  it("rejects a response bound to a different source garden or pool", async () => {
    const f = fixture();
    f.fetch.mockResolvedValueOnce(
      Response.json({
        ok: true,
        payload: encodeServiceIssuerDesk({
          ok: true,
          record: { ...f.record, context: { ...f.record.context, garden: f.record.draft.member } },
        }),
      })
    );
    await expect(f.client.request({ action: "read", id: f.record.draft.id })).rejects.toThrow(
      "Invalid desk response"
    );
  });
  it("keeps member reads scoped to the current recipient and propagates conflicts", async () => {
    const f = fixture();
    f.fetch.mockResolvedValueOnce(
      Response.json({
        ok: true,
        payload: encodeServiceIssuerDesk({
          ok: true,
          records: [issuerDeskFixture("0x3333333333333333333333333333333333333333")],
        }),
      })
    );
    await expect(f.client.request({ action: "list", selection: null })).rejects.toThrow(
      "scope changed"
    );
    f.fetch.mockResolvedValueOnce(
      Response.json({ ok: false, errorCode: "revision_conflict" }, { status: 409 })
    );
    await expect(
      f.client.request({ action: "send", id: f.record.draft.id, expectedRevision: 1 })
    ).rejects.toThrow("revision_conflict");
  });
  it("does not send a proof after the signed-in session changed", async () => {
    const f = fixture();
    f.sign.mockImplementation(async () => {
      f.assertCurrent.mockImplementation(() => {
        throw new Error("session changed");
      });
      return "0x1234";
    });
    await expect(f.client.request({ action: "read", id: f.record.draft.id })).rejects.toThrow(
      "session changed"
    );
    expect(f.fetch).not.toHaveBeenCalled();
  });
});
