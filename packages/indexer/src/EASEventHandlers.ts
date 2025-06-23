import { EAS } from "generated";
import { ethers } from "ethers";

// Schema UIDs for different attestation types
const SCHEMA_UIDS = {
  GARDEN_ASSESSMENT: "0x7433e24287be826b49e5eb28cd52192823e542521c94084a691e67e5cc7e8176",
  WORK: "0x0eb5361c4f892a251e31ff9468ce1b767017eb3696a09bc77955d146c941a25a",
  WORK_APPROVAL: "0x047ed74a39f6e98ed82e4423cba3134c81afe8d97525c1107e2a9ed9c975ec77",
};

// ABI Coder for decoding attestation data
const abiCoder = new ethers.AbiCoder();

// Handler for EAS Attested events
EAS.Attested.handler(async ({ event, context }) => {
  console.log("Processing EAS Attestation:", event.params.uid);

  const attestationEntity = {
    id: event.params.uid,
    attester: event.params.attester,
    recipient: event.params.recipient,
    schema: event.params.schema,
    data: event.params.data,
    time: event.params.time,
    expirationTime: event.params.expirationTime,
    revocable: event.params.revocable,
    refUID: event.params.refUID,
    createdAt: event.block.timestamp,
    revokedAt: null,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  };

  context.Attestation.set(attestationEntity);

  // Parse specific schema types based on known UIDs
  const schemaUID = event.params.schema;

  // Work Schema - 0x0eb5361c4f892a251e31ff9468ce1b767017eb3696a09bc77955d146c941a25a
  if (schemaUID === "0x0eb5361c4f892a251e31ff9468ce1b767017eb3696a09bc77955d146c941a25a") {
    console.log("Processing Work attestation");
    await handleWorkAttestation(event, context);
  }

  // Work Approval Schema - 0x047ed74a39f6e98ed82e4423cba3134c81afe8d97525c1107e2a9ed9c975ec77
  if (schemaUID === "0x047ed74a39f6e98ed82e4423cba3134c81afe8d97525c1107e2a9ed9c975ec77") {
    console.log("Processing Work Approval attestation");
    await handleWorkApprovalAttestation(event, context);
  }

  // Garden Assessment Schema - 0x7433e24287be826b49e5eb28cd52192823e542521c94084a691e67e5cc7e8176
  if (schemaUID === "0x7433e24287be826b49e5eb28cd52192823e542521c94084a691e67e5cc7e8176") {
    console.log("Processing Garden Assessment attestation");
    await handleGardenAssessmentAttestation(event, context);
  }
});

// Handler for EAS Revoked events
EAS.Revoked.handler(async ({ event, context }) => {
  console.log("Processing EAS Revocation:", event.params.uid);

  const attestationId = event.params.uid;
  const existingAttestation = await context.Attestation.get(attestationId);

  if (existingAttestation) {
    context.Attestation.set({
      ...existingAttestation,
      revokedAt: event.block.timestamp,
    });
  }
});

// Helper function to handle Work attestations
async function handleWorkAttestation(event: any, context: any) {
  try {
    // Decode the data field according to Work schema
    // Schema: "uint256 actionUID, string title, string feedback, string metadata, string[] media"
    const decodedData = abiCoder.decode(
      ["uint256", "string", "string", "string", "string[]"],
      event.params.data
    );

    const [actionUID, title, feedback, metadata, media] = decodedData;

    const workEntity = {
      id: event.params.uid,
      attestationUID: event.params.uid,
      attester: event.params.attester,
      recipient: event.params.recipient,
      actionUID: actionUID.toString(),
      title: title || "Untitled Work",
      feedback: feedback || "",
      metadata: metadata || "{}",
      media: media || [],
      createdAt: event.block.timestamp,
      approved: false,
    };

    context.Work.set(workEntity);
    console.log(`Created Work entity: ${title} (${event.params.uid})`);
  } catch (error) {
    console.error("Error processing Work attestation:", error);
  }
}

// Helper function to handle Work Approval attestations
async function handleWorkApprovalAttestation(event: any, context: any) {
  try {
    // Decode the data field according to Work Approval schema
    // Schema: "uint256 actionUID, bytes32 workUID, bool approved, string feedback"

    const workApprovalEntity = {
      id: event.params.uid,
      attestationUID: event.params.uid,
      attester: event.params.attester,
      recipient: event.params.recipient,
      actionUID: "0", // Would need to decode from data
      workUID: "0x0", // Would need to decode from data
      approved: true, // Would need to decode from data
      feedback: "", // Would need to decode from data
      createdAt: event.block.timestamp,
    };

    context.WorkApproval.set(workApprovalEntity);

    // Update the corresponding Work entity if it exists
    const workUID = workApprovalEntity.workUID;
    if (workUID !== "0x0") {
      const existingWork = await context.Work.get(workUID);
      if (existingWork) {
        context.Work.set({
          ...existingWork,
          approved: workApprovalEntity.approved,
        });
      }
    }
  } catch (error) {
    console.error("Error processing Work Approval attestation:", error);
  }
}

// Helper function to handle Garden Assessment attestations
async function handleGardenAssessmentAttestation(event: any, context: any) {
  try {
    // Decode the data field according to Garden Assessment schema
    // Schema: "uint8 soilMoisturePercentage, uint256 carbonTonStock, uint256 carbonTonPotential, uint256 gardenSquareMeters, string biome, string remoteReportPDF, string speciesRegistryJSON, string[] polygonCoordinates, string[] treeGenusesObserved, string[] weedGenusesObserved, string[] issues, string[] tags"

    const gardenAssessmentEntity = {
      id: event.params.uid,
      attestationUID: event.params.uid,
      attester: event.params.attester,
      recipient: event.params.recipient,
      soilMoisturePercentage: 0, // Would need to decode from data
      carbonTonStock: BigInt(0), // Would need to decode from data
      carbonTonPotential: BigInt(0), // Would need to decode from data
      gardenSquareMeters: BigInt(0), // Would need to decode from data
      biome: "", // Would need to decode from data
      remoteReportPDF: "", // Would need to decode from data
      speciesRegistryJSON: "", // Would need to decode from data
      polygonCoordinates: [], // Would need to decode from data
      treeGenusesObserved: [], // Would need to decode from data
      weedGenusesObserved: [], // Would need to decode from data
      issues: [], // Would need to decode from data
      tags: [], // Would need to decode from data
      createdAt: event.block.timestamp,
    };

    context.GardenAssessment.set(gardenAssessmentEntity);
  } catch (error) {
    console.error("Error processing Garden Assessment attestation:", error);
  }
}
