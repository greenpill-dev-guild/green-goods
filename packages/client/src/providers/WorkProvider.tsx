import { z } from "zod";
import toast from "react-hot-toast";
import React, { useContext } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";

import { EAS } from "@/constants";

import { queryClient } from "@/modules/react-query";

import { useUser } from "./UserProvider";
// import { useFieldArray } from "react-hook-form";

export interface WorkDataProps {
  works: WorkCard[];
  workApprovals: WorkApprovalCard[];
  uploadWork?: (draft: WorkDraft) => Promise<string>;
  approveWork?: (draft: WorkApprovalDraft) => Promise<string>;
}

const workSchema = z.object({
  actionUID: z.number(),
  title: z.string(),
  feedback: z.string(),
  metadata: z.string(),
  // media: z.array(z.),
});

const workApprovalSchema = z.object({
  endorsement: z.string().nullish(),
  metrics: z
    .array(
      z
        .object({
          metricUID: z.string(),
          metricName: z.string().optional(),
          metricDescription: z.string().optional(),
          value: z.string(),
          source: z.string().url(),
        })
        .nullish()
    )
    .nullish(),
});

// schema: EAS[11155111].METRICS.uid,
//     data: {
//       recipient: "",
//       revocable: true, // Be aware that if your schema is not revocable, this MUST be false
//       data: encodedData,
//     },

export function encodeWorkData(data: WorkDraft): string {
  const schemaEncoder = new SchemaEncoder(EAS["42161"].WORK.schema);

  const encodedData = schemaEncoder.encodeData([
    { name: "actionUID", value: data.actionUID, type: "uint256" },
    { name: "title", value: data.title, type: "string" },
    { name: "feedback", value: data.feedback, type: "string" },
    { name: "metadata", value: data.metadata, type: "string" },
    { name: "media", value: data.media, type: "string[]" },
  ]);

  return encodedData;
}

export function encodeWorkApprovalData(data: WorkApprovalDraft) {
  const schemaEncoder = new SchemaEncoder(EAS["42161"].WORK_APPROVAL.schema);

  const encodedData = schemaEncoder.encodeData([
    { name: "actionUID", value: data.actionUID, type: "uint256" },
    { name: "workUID", value: data.workUID, type: "bytes32" },
    { name: "approved", value: data.approved, type: "bool" },
    { name: "feedback", value: data.feedback, type: "string" },
  ]);

  return encodedData;
}

const WorkContext = React.createContext<WorkDataProps>({
  works: [],
  workApprovals: [],
  uploadWork: async () => "",
  approveWork: async () => "",
});

export const useWork = () => {
  return useContext(WorkContext);
};

export const WorkProvider = ({ children }: { children: React.ReactNode }) => {
  const { smartAccountClient } = useUser();

  const {} = useForm<WorkDraft>({
    values: {
      actionUID: 0,
      title: "",
      feedback: "",
      metadata: "",
      media: [],
    },
    resolver: zodResolver(workSchema),
  });

  // const { fields } = useFieldArray({
  //   control: control,
  //   name: "media",
  // });

  const {} = useForm<WorkApprovalDraft>({
    values: {
      actionUID: 0,
      workUID: "",
      approved: false,
      feedback: "",
    },
    resolver: zodResolver(workApprovalSchema),
  });

  const { data: works } = useQuery<WorkCard[]>({
    queryKey: ["works"],
    queryFn: () => [],
  });
  const { data: workApprovals } = useQuery<WorkApprovalCard[]>({
    queryKey: ["workApprovals"],
    queryFn: () => [],
  });

  const workMutation = useMutation({
    mutationFn: async (draft: WorkDraft) => {
      if (!smartAccountClient) {
        throw new Error("No smart account client found");
      }

      const encodedData = encodeWorkData(draft);

      const encodedFunctionCall: `0x${string}` = `0x${encodedData}`; // Todo encode function call and arguments

      const receipt = await smartAccountClient.sendTransaction({
        to: EAS["42161"].EAS.address as `0x${string}`,
        data: encodedFunctionCall, // Todo encode solidty function call and arguments
      });

      return receipt;
    },
    onMutate: () => {
      toast.loading("Uploading work...");
    },
    onSuccess: () => {
      toast.success("Work uploaded!");
      queryClient.invalidateQueries({ queryKey: ["works"] });
    },
    onError: () => {
      toast.error("Work upload failed!");
    },
  });
  const workApprovalMutation = useMutation({
    mutationFn: async (draft: WorkApprovalDraft) => {
      if (!smartAccountClient) {
        throw new Error("No smart account client found");
      }

      const encodedData = encodeWorkApprovalData(draft);

      const encodedFunctionCall: `0x${string}` = `0x${encodedData}`; // Todo encode function call and arguments

      const receipt = await smartAccountClient.sendTransaction({
        to: EAS["42161"].EAS.address as `0x${string}`,
        data: encodedFunctionCall, // Todo encode solidty function call and arguments
      });

      return receipt;
    },
    onMutate: () => {
      toast.loading("Approving work...");
    },
    onSuccess: () => {
      toast.success("Work approved!");
      queryClient.invalidateQueries({ queryKey: ["workApprovals"] });
    },
    onError: () => {
      toast.error("Work approval failed!");
    },
  });

  return (
    <WorkContext.Provider
      value={{
        works: works || [],
        workApprovals: workApprovals || [],
        uploadWork: workMutation.mutateAsync,
        approveWork: workApprovalMutation.mutateAsync,
      }}
    >
      {children}
    </WorkContext.Provider>
  );
};
