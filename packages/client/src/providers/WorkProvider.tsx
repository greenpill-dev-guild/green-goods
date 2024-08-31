import { z } from "zod";
import toast from "react-hot-toast";
import React, { useContext, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { FormState, useForm, UseFormRegister } from "react-hook-form";

import { EAS } from "@/constants";

import { queryClient } from "@/modules/react-query";
import { uploadFileToIPFS } from "@/modules/pinata";

import { useUser } from "./UserProvider";
import { useGarden } from "./GardenProvider";

export interface WorkDataProps {
  actions: Action[];
  works: Work[];
  workApprovals: WorkApprovalCard[];
  form: {
    state: FormState<WorkDraft>;
    actionUID: number | null;
    images: File[];
    setImages: React.Dispatch<React.SetStateAction<File[]>>;
    setActionUID: React.Dispatch<React.SetStateAction<number | null>>;
    register: UseFormRegister<WorkDraft>;
    uploadWork?: (e?: React.BaseSyntheticEvent) => Promise<void>;
  };
}

const workSchema = z.object({
  actionUID: z.number(),
  title: z.string(),
  feedback: z.string(),
  metadata: z.string(),
  media: z.array(z.instanceof(File)),
});

// schema: EAS[11155111].METRICS.uid,
//     data: {
//       recipient: "",
//       revocable: true, // Be aware that if your schema is not revocable, this MUST be false
//       data: encodedData,
//     },

async function encodeWorkData(data: WorkDraft): Promise<string> {
  const schemaEncoder = new SchemaEncoder(EAS["42161"].WORK.schema);

  const media = await Promise.all(
    data.media.map(async (file) => {
      return (await uploadFileToIPFS(file)).IpfsHash;
    })
  );

  const encodedData = schemaEncoder.encodeData([
    { name: "actionUID", value: data.actionUID, type: "uint256" },
    { name: "title", value: data.title, type: "string" },
    { name: "feedback", value: data.feedback, type: "string" },
    { name: "metadata", value: data.metadata, type: "string" },
    { name: "media", value: media, type: "string[]" },
  ]);

  return encodedData;
}

const WorkContext = React.createContext<WorkDataProps>({
  actions: [],
  actionUID: null,
  setActionUID: () => {},
  works: [],
  workApprovals: [],
  uploadWork: async () => "",
  form: {
    // @ts-ignore
    register: () => {},
    actionUID: null,
    setActionUID: () => {},
    uploadWork: async () => {},
  },
});

export const useWork = () => {
  return useContext(WorkContext);
};

export const WorkProvider = ({ children }: { children: React.ReactNode }) => {
  const { smartAccountClient } = useUser();
  const { actions } = useGarden();

  // QUERIES
  const { data: works } = useQuery<Work[]>({
    queryKey: ["works"],
    queryFn: () => [],
  });
  const { data: workApprovals } = useQuery<WorkApproval[]>({
    queryKey: ["workApprovals"],
    queryFn: () => [],
  });

  // MUTATIONS
  const [actionUID, setActionUID] = useState<number | null>(null);
  const [images, setImages] = useState<File[]>([]);

  const { register, handleSubmit, formState } = useForm<WorkDraft>({
    defaultValues: {
      actionUID: 0,
      title: "",
      feedback: "",
      metadata: {},
      media: [],
    },
    resolver: zodResolver(workSchema),
  });

  const workMutation = useMutation({
    mutationFn: async (draft: WorkDraft) => {
      if (!smartAccountClient) {
        throw new Error("No smart account client found");
      }

      const encodedData = encodeWorkData({
        ...draft,
        media: images,
      });

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

  const uploadWork = handleSubmit((data) => {
    workMutation.mutate(data);
  });

  return (
    <WorkContext.Provider
      value={{
        actions: actions || [],
        works:
          works?.map((work) => {
            return {
              ...work,
              metadata: JSON.parse(work.metadata),
              approvals:
                workApprovals?.filter(
                  (approval) => approval.workUID === work.id
                ) || [],
            };
          }) || [],
        workApprovals: workApprovals || [],
        form: {
          state: formState,
          register,
          actionUID,
          images,
          setImages,
          setActionUID,
          uploadWork,
        },
      }}
    >
      {children}
    </WorkContext.Provider>
  );
};
