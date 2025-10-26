import { ADDRESS_REGEX } from "@green-goods/shared/stores";

interface ReviewStepProps {
  form: {
    name: string;
    description: string;
    location: string;
    communityToken: string;
    bannerImage: string;
    gardeners: string[];
    operators: string[];
  };
}

export function ReviewStep({ form }: ReviewStepProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-4 rounded-xl border border-gray-100 bg-bg-weak p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              Garden name
            </h4>
            <p className="mt-1 text-sm text-text-strong">{form.name}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              Location
            </h4>
            <p className="mt-1 text-sm text-text-strong">{form.location}</p>
          </div>
          <div className="md:col-span-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              Description
            </h4>
            <p className="mt-1 text-sm text-text-strong">{form.description}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              Community token
            </h4>
            <p className="mt-1 font-mono text-xs text-text-strong">{form.communityToken}</p>
            {!ADDRESS_REGEX.test(form.communityToken.trim()) && (
              <p className="mt-1 text-xs text-red-600">The address doesn&apos;t look valid.</p>
            )}
          </div>
          {form.bannerImage && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
                Banner image
              </h4>
              <p className="mt-1 break-words text-sm text-text-strong">{form.bannerImage}</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              Gardeners
            </h4>
            <ul className="mt-2 space-y-1">
              {form.gardeners.map((gardener) => (
                <li key={gardener} className="font-mono text-xs text-text-strong">
                  {gardener}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              Operators
            </h4>
            {form.operators.length === 0 ? (
              <p className="mt-2 text-xs text-text-soft">No operators assigned yet.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {form.operators.map((operator) => (
                  <li key={operator} className="font-mono text-xs text-text-strong">
                    {operator}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
