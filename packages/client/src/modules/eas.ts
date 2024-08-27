// import { EAS as EAS_REGISTRY } from "@ethereum-attestation-service/eas-sdk";

// import { EAS } from "@/constants";

// export const eas = new EAS_REGISTRY(EAS["11155111"].EAS.address);

export function encodeWorkData(data: any) {
  return data;
}

export function encodeWorkApprovalData(data: any) {
  return data;
}

// export async function createMetric(
//   metric: CreateMetric,
//   signer: TransactionSigner
// ) {
//   "use client";

//   eas.connect(signer);

//   // Initialize SchemaEncoder with the schema string
//   const schemaEncoder = new SchemaEncoder(EAS[11155111].METRICS.schema);

//   const encodedData = schemaEncoder.encodeData([
//     { name: "name", value: metric.name, type: "string" },
//     { name: "description", value: metric.description, type: "string" },
//     { name: "importance", value: metric.impact, type: "string" },
//     { name: "rationale", value: metric.rationale, type: "string" },
//     { name: "keyword", value: metric.keyword, type: "string" },
//     { name: "term", value: metric.term, type: "string" },
//     { name: "category", value: metric.category, type: "string" },
//   ]);

//   const transaction = await eas.attest({
//     schema: EAS[11155111].METRICS.uid,
//     data: {
//       recipient: "",
//       revocable: true, // Be aware that if your schema is not revocable, this MUST be false
//       data: encodedData,
//     },
//   });

//   const newAttestationUID = await transaction.wait();

//   console.log("New attestation UID:", newAttestationUID);
//   console.log("Transaction receipt:", transaction.receipt);
// }

// export async function deprecateMetric(uid: string, signer?: TransactionSigner) {
//   "use client";

//   if (!signer) throw new Error("No signer found");

//   eas.connect(signer);

//   const transaction = await eas.revoke({
//     schema: EAS[11155111].METRICS.uid,
//     data: {
//       uid,
//     },
//   });

//   const newAttestationUID = await transaction.wait();

//   console.log("Revoked UID:", newAttestationUID);
//   console.log("Transaction receipt:", transaction.receipt);
// }

// export const claimProjectMetrics = async (
//   metrics: CreateProjectMetric[],
//   signer?: TransactionSigner
// ) => {
//   "use client";

//   if (!signer) throw new Error("No signer found");

//   eas.connect(signer);

//   const schemaEncoder = new SchemaEncoder(EAS[11155111].PROJECT_METRICS.schema);

//   const data = metrics.map<AttestationRequestData>((metric) => {
//     const encodedData = schemaEncoder.encodeData([
//       { name: "projectUID", value: metric.projectUID, type: "bytes32" },
//       { name: "metricUID", value: metric.metricUID ?? "", type: "bytes32" },
//       { name: "value", value: metric.value, type: "string" },
//       { name: "source", value: metric.source, type: "string" },
//     ]);

//     return {
//       recipient: metric.recipient ?? "",
//       // expirationTime: 0,
//       revocable: true, // Be aware that if your schema is not revocable, this MUST be false
//       data: encodedData,
//     };
//   });

//   const transaction = await eas.multiAttest([
//     {
//       schema: EAS[11155111].PROJECT_METRICS.uid,
//       data,
//     },
//   ]);

//   const uids = await transaction.wait();

//   console.log("New attestation UIDs:", uids);
//   console.log("Transaction receipt:", transaction.receipt);

//   return uids;
// };

// export const getProjectMetrics = async (
//   projectId?: string | null
// ): Promise<ProjectMetricItem[]> => {
//   if (!projectId) {
//     console.error("No project ID provided");
//     return [];
//   }

//   // TODO add 'where: valid: true' filter
//   const QUERY = graphql(/* GraphQL */ `
//     query Attestations($where: AttestationWhereInput) {
//       attestations(where: $where) {
//         id
//         recipient
//         timeCreated
//         decodedDataJson
//       }
//     }
//   `);

//   const { data, error } = await easSepoliaClient
//     .query(QUERY, {
//       where: {
//         schemaId: { equals: EAS["11155111"].PROJECT_METRICS.uid },
//         decodedDataJson: { contains: projectId },
//       },
//     })
//     .toPromise();

//   if (error) console.error(error);
//   if (!data) console.error("No data found");

//   return (
//     data?.attestations.map(({ id, recipient, timeCreated, decodedDataJson }) =>
//       parseDataToProjectMetric(id, recipient, timeCreated, decodedDataJson)
//     ) ?? []
//   );
// };
