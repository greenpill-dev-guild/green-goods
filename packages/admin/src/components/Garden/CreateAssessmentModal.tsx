import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useAccount } from "wagmi";
import { useCreateAssessmentWorkflow } from "@/hooks/useCreateAssessmentWorkflow";

import { useAdminStore } from "@/stores/admin";

const EAS_EXPLORER_URL = "https://base-sepolia.easscan.org/";
export interface CreateAssessmentForm {
  soilMoisturePercentage: number;
  carbonTonStock: number;
  carbonTonPotential: number;
  gardenSquareMeters: number;
  biome: string;
  remoteReportPDF: string;
  speciesRegistryJSON: string;
  polygonCoordinates: string[];
  treeGenusesObserved: string[];
  weedGenusesObserved: string[];
  issues: string[];
  tags: string[];
}

interface CreateAssessmentModalProps {
  gardenId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CreateAssessmentModal({ isOpen, onClose, gardenId }: CreateAssessmentModalProps) {
  const { state, startCreation, submitCreation } = useCreateAssessmentWorkflow();
  const { lastAttestationId, setLastAttestationId } = useAdminStore();
  const { address } = useAccount();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<CreateAssessmentForm>({
    defaultValues: {
      soilMoisturePercentage: 0,
      carbonTonStock: 0,
      carbonTonPotential: 0,
      gardenSquareMeters: 0,
      biome: "",
      remoteReportPDF: "",
      speciesRegistryJSON: "",
      polygonCoordinates: [],
      treeGenusesObserved: [],
      weedGenusesObserved: [],
      issues: [],
      tags: [],
    },
  });

  const onSubmit = async (data: CreateAssessmentForm) => {
    try {
      if (!address) {
        toast.error("Please connect your wallet first");
        return;
      }

      if (!gardenId) {
        toast.error("No garden ID provided");
        return;
      }

      if (typeof window.ethereum === "undefined") {
        toast.error("Web3 provider not found. Please install MetaMask or another web3 wallet.");
        return;
      }

      console.log("Starting creation with params:", { ...data, gardenId });
      startCreation({ ...data, gardenId });
      const uid = await submitCreation();
      setLastAttestationId(uid);
      toast.success(`Assessment submitted successfully! Attestation ID: ${uid}`);
      // Do not reset form, allow user to view success message and link
      handleClose();
    } catch (error: any) {
      const errorMessage = error?.message || "Error submitting assessment. Please try again.";
      toast.error(errorMessage);
      console.error("Submission error:", error);
    }
  };

  const handleClose = () => {
    reset();
    // setLastAttestationId("");
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto pt-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

      <div className="flex min-h-screen items-center justify-center px-4 pt-0 pb-20 text-center sm:block sm:p-0">
        {/* This element is to trick the browser into centering the modal contents. */}
        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
          &#8203;
        </span>

        {/* Modal content */}
        <div className="relative inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl sm:align-middle">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 className="text-lg font-medium leading-6 text-gray-900" id="modal-title">
              Create New Assessment
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Fill in the details to create a new garden assessment attestation.
            </p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-6">
            {/* Numeric Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Soil Moisture Percentage *
                </label>
                <input
                  type="number"
                  {...register("soilMoisturePercentage", {
                    valueAsNumber: true,
                    required: true,
                    min: 0,
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
                {errors.soilMoisturePercentage && (
                  <p className="mt-1 text-sm text-red-600">Must be between 0 and 100</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Carbon Ton Stock *
                </label>
                <input
                  type="number"
                  {...register("carbonTonStock", {
                    valueAsNumber: true,
                    required: true,
                    min: 0,
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
                {errors.carbonTonStock && (
                  <p className="mt-1 text-sm text-red-600">Must be between 0 and 100</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Carbon Ton Potential *
                </label>
                <input
                  type="number"
                  {...register("carbonTonPotential", {
                    valueAsNumber: true,
                    required: true,
                    min: 0,
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
                {errors.carbonTonPotential && (
                  <p className="mt-1 text-sm text-red-600">Must be between 0 and 100</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Garden SquareMeters *
                </label>
                <input
                  type="number"
                  {...register("gardenSquareMeters", {
                    valueAsNumber: true,
                    required: true,
                    min: 0,
                    max: 100,
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
                {errors.gardenSquareMeters && (
                  <p className="mt-1 text-sm text-red-600">Must be between 0 and 100</p>
                )}
              </div>
            </div>

            {/* String Inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Biome *</label>
                <input
                  type="text"
                  {...register("biome", { required: true })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
                {errors.biome && <p className="mt-1 text-sm text-red-600">Required field</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Remote Report PDF *
                </label>
                <input
                  type="text"
                  {...register("remoteReportPDF", { required: true })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
                {errors.remoteReportPDF && (
                  <p className="mt-1 text-sm text-red-600">Required field</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Species Registry JSON *
                </label>
                <input
                  type="text"
                  {...register("speciesRegistryJSON", { required: true })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
                {errors.speciesRegistryJSON && (
                  <p className="mt-1 text-sm text-red-600">Required field</p>
                )}
              </div>
            </div>

            {/* Array Inputs */}
            <div className="space-y-6">
              <ArrayInput control={control} name="polygonCoordinates" label="Polygon Coordinates" />
              <ArrayInput
                control={control}
                name="treeGenusesObserved"
                label="Tree Genuses Observed"
              />
              <ArrayInput
                control={control}
                name="weedGenusesObserved"
                label="Weed Genuses Observed"
              />
              <ArrayInput control={control} name="issues" label="Issues" />
              <ArrayInput control={control} name="tags" label="Tags" />
            </div>

            {/* Submit Button */}
            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 -m-6 mt-6 rounded-b-lg">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={state.matches("submitting")}
                className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {state.matches("submitting") ? "Submitting..." : "Submit"}
              </button>
            </div>
          </form>

          {/* Success message with attestation link */}
          {lastAttestationId && (
            <div className="mt-4 p-4 bg-green-50 rounded-md">
              <p className="text-sm text-green-700">
                Attestation created successfully!{" "}
                <a
                  href={`${EAS_EXPLORER_URL}/attestation/view/${lastAttestationId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline"
                >
                  View on EAS Explorer
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ArrayInputProps {
  control: any;
  name: keyof CreateAssessmentForm;
  label: string;
}

function ArrayInput({ control, name, label }: ArrayInputProps) {
  const { fields, append, remove } = useFieldArray({ control, name });
  const values = useWatch({ control, name }) as string[] | undefined;
  const [value, setValue] = useState("");

  const handleAdd = () => {
    if (value.trim()) {
      append(value);
      setValue("");
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex space-x-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
        >
          Add
        </button>
      </div>
      <div className="space-y-2 pt-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
            <span>{values && values[index] ? String(values[index]) : ""}</span>
            <button
              type="button"
              onClick={() => remove(index)}
              className="text-red-600 hover:text-red-800"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
