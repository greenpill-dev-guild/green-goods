import { beforeEach, describe, expect, it } from "vitest";
import {
  useAssessmentSubmissionStore,
  assessmentSubmissionKey,
} from "../../stores/useAssessmentSubmissionStore";
import {
  useListingSubmissionStore,
  listingSubmissionKey,
} from "../../stores/useListingSubmissionStore";

const account = "0x1111111111111111111111111111111111111111" as const;
const other = "0x2222222222222222222222222222222222222222" as const;
const garden = "0x3333333333333333333333333333333333333333" as const;
const result = { hash: "0xProposal" as const, sponsored: false, confirmation: "pending" as const };
const assessment = {
  account,
  chainId: 11155111,
  gardenId: garden,
  easAddress: other,
  schemaUid: `0x${"44".repeat(32)}`,
  result,
};
const listing = {
  account,
  chainId: 11155111,
  garden,
  signature: "0xab" as const,
  hypercertId: "123456789012345678901234567890",
  currency: other,
  result,
};

describe("accepted submission ledgers", () => {
  beforeEach(() => {
    useAssessmentSubmissionStore.setState({ pending: {} });
    useListingSubmissionStore.setState({ pending: {} });
  });
  it("restores assessment transaction and EAS identity after a browser reload", async () => {
    useAssessmentSubmissionStore.getState().record(assessment);
    const saved = sessionStorage.getItem("green-goods:assessment-submissions")!;
    useAssessmentSubmissionStore.setState({ pending: {} });
    sessionStorage.setItem("green-goods:assessment-submissions", saved);
    await useAssessmentSubmissionStore.persist.rehydrate();
    expect(Object.values(useAssessmentSubmissionStore.getState().pending)).toEqual([assessment]);
  });
  it("isolates assessment accounts and preserves another account's proposal on cleanup", () => {
    const store = useAssessmentSubmissionStore.getState();
    store.record(assessment);
    store.record({ ...assessment, account: other });
    store.clear(assessmentSubmissionKey(account, 11155111, garden));
    expect(Object.values(useAssessmentSubmissionStore.getState().pending)).toEqual([
      { ...assessment, account: other },
    ]);
  });
  it("keeps assessment proposals on distinct chains separate", () => {
    const store = useAssessmentSubmissionStore.getState();
    store.record(assessment);
    store.record({ ...assessment, chainId: 42161 });
    store.clear(assessmentSubmissionKey(account, 11155111, garden));
    expect(Object.values(useAssessmentSubmissionStore.getState().pending)).toEqual([
      { ...assessment, chainId: 42161 },
    ]);
  });
  it("does not block an assessment for another garden", () => {
    useAssessmentSubmissionStore.getState().record(assessment);
    expect(
      useAssessmentSubmissionStore.getState().pending[
        assessmentSubmissionKey(account, 11155111, other)
      ]
    ).toBeUndefined();
  });
  it("restores the exact signed listing and lossless hypercert identifier", async () => {
    useListingSubmissionStore.getState().record(listing);
    const saved = sessionStorage.getItem("green-goods:listing-submissions")!;
    useListingSubmissionStore.setState({ pending: {} });
    sessionStorage.setItem("green-goods:listing-submissions", saved);
    await useListingSubmissionStore.persist.rehydrate();
    expect(Object.values(useListingSubmissionStore.getState().pending)).toEqual([listing]);
  });
  it("isolates listing accounts across cleanup", () => {
    const store = useListingSubmissionStore.getState();
    store.record(listing);
    store.record({ ...listing, account: other });
    store.clear(listingSubmissionKey(account, 11155111, garden));
    expect(Object.values(useListingSubmissionStore.getState().pending)).toEqual([
      { ...listing, account: other },
    ]);
  });
  it("preserves listings on another chain", () => {
    const store = useListingSubmissionStore.getState();
    store.record(listing);
    store.record({ ...listing, chainId: 42161 });
    store.clear(listingSubmissionKey(account, 11155111, garden));
    expect(Object.values(useListingSubmissionStore.getState().pending)).toEqual([
      { ...listing, chainId: 42161 },
    ]);
  });
  it("permits a different garden's listing without forgetting the existing proposal", () => {
    useListingSubmissionStore.getState().record(listing);
    expect(
      useListingSubmissionStore.getState().pending[listingSubmissionKey(account, 11155111, other)]
    ).toBeUndefined();
    expect(Object.values(useListingSubmissionStore.getState().pending)).toEqual([listing]);
  });
});
