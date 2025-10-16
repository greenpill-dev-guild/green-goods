import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { CreateAssessmentModal } from "@/components/Garden/CreateAssessmentModal";
import { RiArrowLeftLine, RiExternalLinkLine, RiFileList3Line } from "@remixicon/react";

import { useGardenAssessments } from "@/hooks/useGardenAssessments";

const EAS_EXPLORER_URL = "https://explorer.easscan.org";

export default function GardenAssessment() {
  const { id } = useParams<{ id: string }>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { data: assessments = [], isLoading: fetching, error } = useGardenAssessments(id);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Link
            to={`/gardens/${id}`}
            className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md flex-shrink-0"
          >
            <RiArrowLeftLine className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Garden Assessments
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Viewing all assessments for this garden.
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          Create Assessment
        </button>
      </div>

      {fetching && (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading assessments...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">
            Error loading assessments: {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      )}

      {!fetching && !error && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          {assessments.length === 0 ? (
            <div className="text-center py-16">
              <RiFileList3Line className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No assessments found</h3>
              <p className="mt-1 text-sm text-gray-500">
                This garden does not have any assessments yet.
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attestation UID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CO2 Stock (T)
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">View</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {assessments.map((attestation: any) => {
                  const assessmentData = attestation.decodedDataJson
                    ? JSON.parse(attestation.decodedDataJson)
                    : {};
                  return (
                    <tr key={attestation.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{`${attestation.id.slice(0, 10)}...`}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {new Date(attestation.time * 1000).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {assessmentData.carbonTonStock ?? "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <a
                          href={`${EAS_EXPLORER_URL}/attestation/view/${attestation.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-900 inline-flex items-center"
                        >
                          View <RiExternalLinkLine className="ml-1 h-4 w-4" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
      <CreateAssessmentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        gardenId={id!}
      />
    </div>
  );
}
