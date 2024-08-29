import toast from "react-hot-toast";
import React, { useContext } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { queryClient } from "@/modules/react-query";

export interface WorkDataProps {
  works: WorkCard[];
  workApprovals: WorkApprovalCard[];
  uploadWork?: (draft: WorkDraft) => Promise<string>;
  approveWork?: (draft: WorkApprovalDraft) => Promise<string>;
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
      return draft.feedback;
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
      return draft.feedback;
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
