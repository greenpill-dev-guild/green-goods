import { DEFAULT_CHAIN_ID, formatDateTime } from "@green-goods/shared";
import { useActions } from "@green-goods/shared/hooks";
import { RiEditLine } from "@remixicon/react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";

export default function ActionDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: actions = [] } = useActions(DEFAULT_CHAIN_ID);
  const action = actions.find((a) => a.id === id);

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

  return (
    <div>
      <PageHeader
        title={action.title}
        description={`Action ${id}`}
        actions={
          <Link
            to={`/actions/${id}/edit`}
            className="inline-flex items-center rounded-md border border-stroke-soft px-4 py-2 text-sm font-medium text-text-strong hover:bg-bg-soft"
          >
            <RiEditLine className="mr-2 h-4 w-4" />
            Edit
          </Link>
        }
      />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Media Gallery */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-stroke-soft bg-bg-white p-6">
            <h3 className="text-lg font-semibold mb-4">Media</h3>
            <div className="grid grid-cols-2 gap-4">
              {action.media.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Media ${i + 1}`}
                  className="w-full h-48 object-cover rounded"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Details Sidebar */}
        <div className="space-y-6">
          <div className="rounded-lg border border-stroke-soft bg-bg-white p-6">
            <h3 className="text-lg font-semibold mb-4">Details</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-text-soft">Start Time</dt>
                <dd className="text-sm font-medium text-text-strong">
                  {formatDateTime(action.startTime)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-text-soft">End Time</dt>
                <dd className="text-sm font-medium text-text-strong">
                  {formatDateTime(action.endTime)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-text-soft">Capitals</dt>
                <dd className="text-sm font-medium text-text-strong">
                  {action.capitals.length} forms
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-stroke-soft bg-bg-white p-6">
            <h3 className="text-lg font-semibold mb-4">Description</h3>
            <p className="text-text-sub">{action.description || "No description"}</p>
          </div>

          {/* Form Configuration */}
          {action.inputs && action.inputs.length > 0 && (
            <div className="rounded-lg border border-stroke-soft bg-bg-white p-6">
              <h3 className="text-lg font-semibold mb-4">Form Fields</h3>
              <ul className="space-y-2">
                {action.inputs.map((input, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium text-text-strong">{input.title}</span>
                    <span className="text-text-soft ml-2">({input.type})</span>
                    {input.required && <span className="text-error-base ml-1">*</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
