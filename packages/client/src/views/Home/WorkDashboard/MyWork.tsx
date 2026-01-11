import { useOffline } from "@green-goods/shared/hooks";
import { useQueueFlush } from "@green-goods/shared/providers/JobQueue";
import React from "react";
import { MinimalWorkCard } from "@/components/Cards";

interface MyWorkTabProps {
  works: Work[];
  isLoading: boolean;
  onWorkClick: (work: Work) => void;
}

export const MyWorkTab: React.FC<MyWorkTabProps> = ({ works, isLoading, onWorkClick }) => {
  const { isOnline } = useOffline();
  const flush = useQueueFlush();

  const handleFlushAll = async () => {
    try {
      await flush();
    } catch (error) {
      console.error("Failed to flush queue:", error);
    }
  };

  // Separate offline and online works
  const offlineWorks = works.filter((w) => w.id.startsWith("0xoffline_") || !w.id.startsWith("0x"));

  return (
    <div className="h-full flex flex-col">
      {/* Header with flush button */}
      {offlineWorks.length > 0 && (
        <div className="px-4 pt-4 pb-2 border-b border-stroke-soft-200">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-sub-600">
              {offlineWorks.length} work{offlineWorks.length !== 1 ? "s" : ""} pending upload
            </p>
            {isOnline && (
              <button
                onClick={handleFlushAll}
                className="text-sm text-primary font-medium px-3 py-1 rounded-lg border border-stroke-soft-200 hover:bg-bg-weak-50 transition-colors"
              >
                Upload All
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="space-y-3 mt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 border rounded-xl bg-bg-white-0 animate-pulse">
                <div className="h-4 w-40 bg-bg-soft-200 rounded mb-2" />
                <div className="h-3 w-64 bg-bg-soft-200 rounded" />
              </div>
            ))}
          </div>
        ) : works.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🌱</div>
            <p className="font-medium text-text-strong-950">No work yet</p>
            <p className="text-sm text-text-sub-600">Submit your first work to get started</p>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {works.map((work) => {
              const isOffline = work.id.startsWith("0xoffline_") || !work.id.startsWith("0x");

              return (
                <MinimalWorkCard
                  key={work.id}
                  work={work}
                  onClick={() => onWorkClick(work)}
                  badges={
                    isOffline
                      ? [
                          <span key="pending" className="badge-pill-amber">
                            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                            Pending Upload
                          </span>,
                        ]
                      : work.status === "approved"
                        ? [
                            <span key="approved" className="badge-pill-green">
                              Approved
                            </span>,
                          ]
                        : work.status === "rejected"
                          ? [
                              <span key="rejected" className="badge-pill-red">
                                Rejected
                              </span>,
                            ]
                          : []
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
