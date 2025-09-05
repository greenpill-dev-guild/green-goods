import { useState } from "react";
import { useForm } from "react-hook-form";
import { RiCloseLine, RiAddLine, RiDeleteBinLine } from "@remixicon/react";
import { useCreateGardenWorkflow } from "@/hooks/useCreateGardenWorkflow";
import { cn } from "@/utils/cn";

interface CreateGardenForm {
  name: string;
  description: string;
  location: string;
  bannerImage?: string;
  communityToken: string;
  gardeners: string[];
  operators: string[];
}

interface CreateGardenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateGardenModal({ isOpen, onClose }: CreateGardenModalProps) {
  const [gardenerInput, setGardenerInput] = useState("");
  const [operatorInput, setOperatorInput] = useState("");
  const { state, startCreation, submitCreation } = useCreateGardenWorkflow();
  const isCreating = state.matches('creating');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
    reset,
  } = useForm<CreateGardenForm>({
    defaultValues: {
      gardeners: [],
      operators: [],
      bannerImage: "",
    },
  });

  const gardeners = watch("gardeners");
  const operators = watch("operators");

  const addGardener = () => {
    if (gardenerInput && /^0x[a-fA-F0-9]{40}$/.test(gardenerInput)) {
      setValue("gardeners", [...gardeners, gardenerInput]);
      setGardenerInput("");
    }
  };

  const removeGardener = (index: number) => {
    setValue("gardeners", gardeners.filter((_, i) => i !== index));
  };

  const addOperator = () => {
    if (operatorInput && /^0x[a-fA-F0-9]{40}$/.test(operatorInput)) {
      setValue("operators", [...operators, operatorInput]);
      setOperatorInput("");
    }
  };

  const removeOperator = (index: number) => {
    setValue("operators", operators.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: CreateGardenForm) => {
    // Manual validation
    if (!data.name) {
      setError("name", { type: "required", message: "Garden name is required" });
      return;
    }
    if (!data.description) {
      setError("description", { type: "required", message: "Description is required" });
      return;
    }
    if (!data.location) {
      setError("location", { type: "required", message: "Location is required" });
      return;
    }
    if (!data.communityToken || !/^0x[a-fA-F0-9]{40}$/.test(data.communityToken)) {
      setError("communityToken", { type: "pattern", message: "Must be a valid address" });
      return;
    }

    try {
      startCreation({
        communityToken: data.communityToken,
        name: data.name,
        description: data.description,
        location: data.location,
        bannerImage: data.bannerImage || "",
        gardeners: data.gardeners,
        gardenOperators: data.operators,
      });
      await submitCreation();
      reset();
      onClose();
    } catch (error) {
      // console.error("Failed to create garden:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" 
          onClick={onClose}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          role="button"
          tabIndex={0}
          aria-label="Close modal"
        />

        <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">Create New Garden</h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
            >
              <RiCloseLine className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="garden-name" className="block text-sm font-medium text-gray-700 mb-2">
                  Garden Name *
                </label>
                <input
                  id="garden-name"
                  {...register("name")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Enter garden name"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="garden-location" className="block text-sm font-medium text-gray-700 mb-2">
                  Location *
                </label>
                <input
                  id="garden-location"
                  {...register("location")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Enter location"
                />
                {errors.location && (
                  <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="garden-description" className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                id="garden-description"
                {...register("description")}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Enter garden description"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="community-token" className="block text-sm font-medium text-gray-700 mb-2">
                  Community Token Address *
                </label>
                <input
                  id="community-token"
                  {...register("communityToken")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="0x..."
                />
                {errors.communityToken && (
                  <p className="mt-1 text-sm text-red-600">{errors.communityToken.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="banner-image" className="block text-sm font-medium text-gray-700 mb-2">
                  Banner Image URL
                </label>
                <input
                  id="banner-image"
                  {...register("bannerImage")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="https://..."
                />
                {errors.bannerImage && (
                  <p className="mt-1 text-sm text-red-600">{errors.bannerImage.message}</p>
                )}
              </div>
            </div>

            {/* Gardeners */}
            <div>
              <label htmlFor="gardener-input" className="block text-sm font-medium text-gray-700 mb-2">
                Gardeners
              </label>
              <div className="flex space-x-2 mb-2">
                <input
                  id="gardener-input"
                  value={gardenerInput}
                  onChange={(e) => setGardenerInput(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="0x... (gardener address)"
                />
                <button
                  type="button"
                  onClick={addGardener}
                  className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  <RiAddLine className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {gardeners.map((gardener, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                    <span className="text-sm font-mono">{gardener}</span>
                    <button
                      type="button"
                      onClick={() => removeGardener(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <RiDeleteBinLine className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Operators */}
            <div>
              <label htmlFor="operator-input" className="block text-sm font-medium text-gray-700 mb-2">
                Operators
              </label>
              <div className="flex space-x-2 mb-2">
                <input
                  id="operator-input"
                  value={operatorInput}
                  onChange={(e) => setOperatorInput(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="0x... (operator address)"
                />
                <button
                  type="button"
                  onClick={addOperator}
                  className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  <RiAddLine className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {operators.map((operator, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                    <span className="text-sm font-mono">{operator}</span>
                    <button
                      type="button"
                      onClick={() => removeOperator(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <RiDeleteBinLine className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className={cn(
                  "px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500",
                  isCreating
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                )}
              >
                {isCreating ? "Creating..." : "Create Garden"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}