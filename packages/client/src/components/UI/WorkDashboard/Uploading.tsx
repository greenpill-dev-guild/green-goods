import React from "react";
import { useIntl } from "react-intl";
import { BeatLoader } from "../Loader";
import { MinimalWorkCard } from "../Card/WorkCard";
import { jobQueue } from "../../../modules/job-queue";

interface UploadingTabProps {
  uploadingWork: any[];
  isLoading: boolean;
  onWorkClick: (work: any) => void;
}

export const UploadingTab: React.FC<UploadingTabProps> = ({
  uploadingWork,
  isLoading,
  onWorkClick,
}) => {
  const intl = useIntl();

  const handleSyncAll = async () => {
    try {
      await jobQueue.flush();
    } catch (error) {
      console.error("Failed to sync all items:", error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 px-4 pt-4">
        {isLoading ? (
          <BeatLoader />
        ) : (
          <p className="text-sm text-slate-600">
            {uploadingWork.length > 0
              ? intl.formatMessage(
                  {
                    id: "app.workDashboard.uploading.itemsUploading",
                    defaultMessage: "{count} items uploading",
                  },
                  { count: uploadingWork.length }
                )
              : intl.formatMessage({
                  id: "app.workDashboard.uploading.noUploading",
                  defaultMessage: "No items uploading",
                })}
          </p>
        )}
        {uploadingWork.length > 0 && (
          <button
            className="text-sm text-primary font-medium px-3 py-1 rounded-lg border border-slate-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary active:border-primary active:scale-95"
            onClick={handleSyncAll}
          >
            {intl.formatMessage({
              id: "app.workDashboard.queue.syncAll",
              defaultMessage: "Sync All",
            })}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {!isLoading && uploadingWork.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-medium text-slate-900">
              {intl.formatMessage({
                id: "app.workDashboard.uploading.allSynced",
                defaultMessage: "All synced!",
              })}
            </p>
            <p className="text-sm text-slate-600">
              {intl.formatMessage({
                id: "app.workDashboard.uploading.noUploading",
                defaultMessage: "No items uploading",
              })}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {uploadingWork.map((work) => (
              <MinimalWorkCard key={work.id} work={work} onClick={() => onWorkClick(work)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
