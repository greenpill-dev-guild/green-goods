/** Hasura supports array containment; use one clause per linked record for any-match exclusion. */
export function hypercertExclusionClauses(links: {
  commitmentEntityIds: readonly string[];
  attestationUIDs: readonly string[];
}) {
  return [
    ...links.commitmentEntityIds.map((id) => ({ commitmentEntityIds: { _contains: [id] } })),
    ...links.attestationUIDs.map((id) => ({ attestationUIDs: { _contains: [id] } })),
  ];
}
