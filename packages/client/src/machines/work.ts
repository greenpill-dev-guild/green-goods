import toast from "react-hot-toast";
import { JsonRpcSigner } from "ethers";
import { setup, fromPromise } from "xstate";
import {
  SchemaEncoder,
  TransactionSigner,
} from "@ethereum-attestation-service/eas-sdk";

import { EAS } from "@/constants";

export const makeEndorsement = async (
  endorsement: any,
  signer?: TransactionSigner
) => {
  "use client";

  if (!signer) throw new Error("No signer provided");

  // Initialize SchemaEncoder with the schema string
  const schemaEncoder = new SchemaEncoder(EAS["10"].WORK.schema);

  if (!endorsement.projectUID) throw new Error("No project UID provided");
  if (!endorsement.metricUID) throw new Error("No metric UID provided");
  if (!endorsement.description) throw new Error("No description provided");

  const encodedData = schemaEncoder.encodeData([
    { name: "projectUID", value: endorsement.projectUID, type: "bytes32" },
    { name: "metricUID", value: endorsement.metricUID, type: "bytes32" },
    { name: "description", value: endorsement.description, type: "string" },
  ]);
  console.log("Making endorsement attestation...");

  // console.log("New attestation UID:", newAttestationUID);
  // console.log("Transaction receipt:", transaction.receipt);

  return "newAttestationUID";
};

interface Context {
  projectUID: string;
  signer: JsonRpcSigner;
}

export const endorsementMachine = setup({
  types: {} as {
    input: Context;
    context: Context;
    events:
      | { type: "START_ENDORSING" }
      | {
          type: "ENDORSE";
          endorsement: any;
          signer: JsonRpcSigner;
        }
      | { type: "CANCEL" }
      | { type: `xstate.done.actor.endorser`; output: string }
      | { type: `xstate.error.actor.endorser`; error: unknown };
  },
  actions: {
    handleSuccess: ({ event }) => {
      const id =
        event.type === "xstate.done.actor.endorser" ? event.output : "";

      toast.success(
        `Endorsement successful, view it here https://optimism-sepolia.easscan.org/onchain/attestation/view/${id}`
      );
    },
    handleError: () => {
      toast.error("Endorsement failed:");
    },
  },
  actors: {
    makeEndorsement: fromPromise<
      string,
      { endorsement: any; signer?: JsonRpcSigner }
    >(async ({ input: { endorsement, signer } }) => {
      // Function to make the endorsement attestation
      console.log("Making endorsement attestation...", endorsement, signer);

      return await makeEndorsement(endorsement, signer);
    }),
  },
}).createMachine({
  id: "project-endorsement",
  initial: "endorse",
  context: ({
    input: { signer, projectUID },
  }: {
    input: { signer: JsonRpcSigner; projectUID: string };
  }) =>
    ({
      signer,
      projectUID,
    }) as Context,
  states: {
    idle: {
      on: {
        START_ENDORSING: "endorse",
      },
    },
    endorse: {
      on: {
        ENDORSE: "endorsing",
        CANCEL: "idle",
      },
    },
    endorsing: {
      invoke: {
        id: "endorser",
        src: "makeEndorsement",
        input: ({ event }) =>
          event.type === "ENDORSE" ?
            {
              endorsement: event.endorsement,

              signer: event.signer,
            }
          : {
              endorsement: {
                metricUID: "",
                projectUID: "",
                description: "",
                recipient: "",
              },
            },
        onDone: {
          target: "endorsed",
          actions: "handleSuccess",
        },
        onError: {
          target: "endorse",
          actions: "handleError",
        },
      },
    },
    endorsed: {
      type: "final",
    },
  },
});
