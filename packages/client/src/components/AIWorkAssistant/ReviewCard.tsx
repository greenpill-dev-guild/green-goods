import React from "react";
import type { WorkSession } from "@/schemas/workSession";

export const ReviewCard: React.FC<{ data: WorkSession }> = ({ data }) => {
  return (
    <div className="rounded border p-3 text-sm space-y-2">
      <div className="font-semibold">AI Summary</div>
      <div>
        <span className="font-medium">Action:</span> {data.actionType}
      </div>
      <div>
        <span className="font-medium">Description:</span> {data.description}
      </div>
      {data.location && (
        <div>
          <span className="font-medium">Location:</span> {data.location}
        </div>
      )}
      {data.materialsUsed?.length > 0 && (
        <div>
          <span className="font-medium">Materials:</span> {data.materialsUsed.join(", ")}
        </div>
      )}
    </div>
  );
};
