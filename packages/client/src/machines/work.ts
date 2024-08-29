import toast from "react-hot-toast";
import { JsonRpcSigner } from "ethers";
import { setup, fromPromise } from "xstate";
import {
  SchemaEncoder,
  TransactionSigner,
} from "@ethereum-attestation-service/eas-sdk";

import { EAS } from "@/constants";

export async function uploadWork(endorsement: any, signer?: TransactionSigner) {
  if (!signer) throw new Error("No signer provided");

  // Initialize SchemaEncoder with the schema string
  const schemaEncoder = new SchemaEncoder(EAS["42161"].WORK.schema);

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
}

interface Context {
  projectUID: string;
  signer: JsonRpcSigner;
}

export const endorsementMachine = setup({
  types: {} as {
    input: Context;
    context: Context;
    events:
      | { type: "START_" }
      | {
          type: "WORK";
          endorsement: any;
          signer: JsonRpcSigner;
        }
      | { type: "CANCEL" }
      | { type: `xstate.done.actor.uploader`; output: string }
      | { type: `xstate.error.actor.uploader`; error: unknown };
  },
  actions: {
    handleSuccess: ({ event }) => {
      const id =
        event.type === "xstate.done.actor.uploader" ? event.output : "";

      toast.success(
        `Endorsement successful, view it here https://optimism-sepolia.easscan.org/onchain/attestation/view/${id}`
      );
    },
    handleError: () => {
      toast.error("Endorsement failed:");
    },
  },
  actors: {
    uploadWork: fromPromise<
      string,
      { endorsement: any; signer?: JsonRpcSigner }
    >(async ({ input: { endorsement, signer } }) => {
      // Function to make the endorsement attestation
      console.log("Making endorsement attestation...", endorsement, signer);

      return await uploadWork(endorsement, signer);
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
        START_: "endorse",
      },
    },
    media: {
      on: {
        WORK: "uploading",
        CANCEL: "idle",
      },
    },
    details: {
      on: {
        WORK: "uploading",
        CANCEL: "idle",
      },
    },
    review: {
      on: {
        WORK: "uploading",
        CANCEL: "idle",
      },
    },
    uploading: {
      invoke: {
        id: "uploader",
        src: "uploadWork",
        input: ({ event }) =>
          event.type === "WORK" ?
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
          target: "uploaded",
          actions: "handleSuccess",
        },
        onError: {
          target: "endorse",
          actions: "handleError",
        },
      },
    },
    uploaded: {
      type: "final",
    },
  },
});
