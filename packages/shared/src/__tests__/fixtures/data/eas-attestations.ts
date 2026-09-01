export const gardenAssessmentAttestation = {
  id: "0xAssessment1",
  attester: "0x04D60647836bcA09c37B379550038BdaaFD82503",
  recipient: "0x1111111111111111111111111111111111111111",
  timeCreated: 1_700_000_000,
  decodedDataJson: JSON.stringify([
    { name: "title", value: { value: "Test Assessment" } },
    { name: "description", value: { value: "Test Description" } },
    { name: "assessmentConfigCID", value: { value: "bafyConfigCID123" } },
    { name: "domain", value: { value: { hex: "0x03" } } },
    { name: "startDate", value: { value: { hex: "0x65B8D800" } } },
    { name: "endDate", value: { value: { hex: "0x660D5800" } } },
    { name: "location", value: { value: "Austin TX" } },
  ]),
};

export const workAttestation = {
  id: "0xWork1",
  attester: "0x1234567890123456789012345678901234567890",
  recipient: "0x1111111111111111111111111111111111111111",
  timeCreated: 1_700_000_000,
  decodedDataJson: JSON.stringify([
    { name: "feedback", value: { value: "Great work" } },
    { name: "media", value: { value: ["QmWorkImage"] } },
    { name: "actionUID", value: { value: { hex: "0x1" } } },
  ]),
};

export const workApprovalAttestation = {
  id: "0xApproval1",
  attester: "0x04D60647836bcA09c37B379550038BdaaFD82503",
  recipient: "0x1234567890123456789012345678901234567890",
  timeCreated: 1_700_000_000,
  decodedDataJson: JSON.stringify([
    { name: "workUID", value: { value: "0xWork1" } },
    { name: "approved", value: { value: true } },
    { name: "feedback", value: { value: "Approved!" } },
    { name: "actionUID", value: { value: { hex: "0x1" } } },
  ]),
};
