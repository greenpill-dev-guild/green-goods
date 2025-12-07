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
        <div className="px-4 pt-4 pb-2 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              {offlineWorks.length} work{offlineWorks.length !== 1 ? "s" : ""} pending upload
            </p>
            {isOnline && (
              <button
                onClick={handleFlushAll}
                className="text-sm text-primary font-medium px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
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
              <div key={i} className="p-4 border rounded-xl bg-white animate-pulse">
                <div className="h-4 w-40 bg-slate-200 rounded mb-2" />
                <div className="h-3 w-64 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : works.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🌱</div>
            <p className="font-medium text-slate-900">No work yet</p>
            <p className="text-sm text-slate-600">Submit your first work to get started</p>
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
                          <span
                            key="pending"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-600 border-amber-100"
                          >
                            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                            Pending Upload
                          </span>,
                        ]
                      : work.status === "approved"
                        ? [
                            <span
                              key="approved"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border bg-green-50 text-green-600 border-green-100"
                            >
                              Approved
                            </span>,
                          ]
                        : work.status === "rejected"
                          ? [
                              <span
                                key="rejected"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-100"
                              >
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
