import {
  DEFAULT_CHAIN_ID,
  defaultTemplate,
  toastService,
  uploadFileToIPFS,
} from "@green-goods/shared";
import { useActionOperations, useActions } from "@green-goods/shared/hooks";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { InstructionsBuilder } from "@/components/Action/InstructionsBuilder";
import { PageHeader } from "@/components/Layout/PageHeader";

export default function EditAction() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: actions = [] } = useActions(DEFAULT_CHAIN_ID);
  const action = actions.find((a) => a.id === id);
  const {
    updateActionTitle,
    updateActionStartTime,
    updateActionEndTime,
    updateActionInstructions,
    isLoading,
  } = useActionOperations(DEFAULT_CHAIN_ID);

  const [title, setTitle] = useState(action?.title || "");
  const [startTime, setStartTime] = useState(action ? new Date(action.startTime) : new Date());
  const [endTime, setEndTime] = useState(action ? new Date(action.endTime) : new Date());
  const [instructionConfig, setInstructionConfig] =
    useState<ActionInstructionConfig>(defaultTemplate);
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const [isLoadingInstructions, setIsLoadingInstructions] = useState(false);

  // Load existing instruction config from IPFS when action is available
  useEffect(() => {
    async function loadInstructions() {
      if (!action?.instructions) return;

      setIsLoadingInstructions(true);
      try {
        const response = await fetch(action.instructions);
        const config = await response.json();
        setInstructionConfig(config);
      } catch (error) {
        console.error("Failed to load instructions:", error);
        toastService.error({
          title: "Failed to load instructions",
          description: "Using default template instead",
        });
      } finally {
        setIsLoadingInstructions(false);
      }
    }

    loadInstructions();
  }, [action?.instructions]);

  if (!action) {
    return (
      <div className="text-center py-12">
        <p className="text-text-sub">Action not found</p>
        <Link to="/actions" className="text-green-600 hover:underline mt-2 inline-block">
          Back to Actions
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Extract numeric UID from composite ID (chainId-UID format)
      const actionUID = id!.split("-")[1];

      if (title !== action.title) {
        await updateActionTitle(actionUID, title);
      }

      if (startTime.getTime() !== action.startTime) {
        await updateActionStartTime(actionUID, Math.floor(startTime.getTime() / 1000));
      }

      if (endTime.getTime() !== action.endTime) {
        await updateActionEndTime(actionUID, Math.floor(endTime.getTime() / 1000));
      }

      // If instructions were edited, upload new version to IPFS
      if (isEditingInstructions) {
        toastService.loading({ title: "Uploading new instructions to IPFS..." });
        const instructionsBlob = new Blob([JSON.stringify(instructionConfig, null, 2)], {
          type: "application/json",
        });
        const instructionsFile = new File([instructionsBlob], "instructions.json", {
          type: "application/json",
        });
        const instructionsUpload = await uploadFileToIPFS(instructionsFile);
        const instructionsCID = instructionsUpload.cid;
        toastService.dismiss();

        await updateActionInstructions(actionUID, instructionsCID);
      }

      toastService.success({ title: "Action updated successfully" });
      navigate(`/actions/${id}`);
    } catch (error) {
      console.error("Failed to update action:", error);
      toastService.error({ title: "Failed to update action" });
    }
  };

  return (
    <div>
      <PageHeader title={`Edit: ${action.title}`} description="Update action details" />

      <form onSubmit={handleSubmit} className="mt-6 max-w-4xl space-y-6">
        {/* Basic Fields */}
        <div className="rounded-lg border border-stroke-soft bg-bg-white p-6">
          <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-strong mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-stroke-soft px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-strong mb-2">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={startTime.toISOString().slice(0, 16)}
                  onChange={(e) => setStartTime(new Date(e.target.value))}
                  className="w-full rounded-md border border-stroke-soft px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-strong mb-2">End Time</label>
                <input
                  type="datetime-local"
                  value={endTime.toISOString().slice(0, 16)}
                  onChange={(e) => setEndTime(new Date(e.target.value))}
                  className="w-full rounded-md border border-stroke-soft px-3 py-2"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Instructions Configuration */}
        <div className="rounded-lg border border-stroke-soft bg-bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Instructions Configuration</h3>
            {!isLoadingInstructions && (
              <button
                type="button"
                onClick={() => setIsEditingInstructions(!isEditingInstructions)}
                className="text-sm text-green-600 hover:text-green-700"
              >
                {isEditingInstructions ? "Cancel editing" : "Edit instructions"}
              </button>
            )}
          </div>

          {isLoadingInstructions ? (
            <p className="text-text-sub text-sm">Loading instructions...</p>
          ) : isEditingInstructions ? (
            <InstructionsBuilder value={instructionConfig} onChange={setInstructionConfig} />
          ) : (
            <p className="text-text-sub text-sm">
              Click "Edit instructions" to modify the work submission form configuration. This will
              create a new version of the instructions.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/actions/${id}`)}
            className="rounded-md border border-stroke-soft px-4 py-2 text-sm font-medium text-text-strong hover:bg-bg-soft"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
