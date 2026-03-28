import { logger, useGardens } from "@green-goods/shared";
import { useIntl } from "react-intl";

/**
 * Public fund page — single scrollable view per spec section 18.
 * Deposit-only (no withdraw). Actual deposit dialogs wired in Phase 3.
 */
export default function FundPage() {
  const { formatMessage } = useIntl();
  const { data: gardens = [], isLoading } = useGardens();

  const totalGardeners = new Set(gardens.flatMap((g) => g.gardeners ?? [])).size;

  const handleDeposit = (gardenId: string) => {
    logger.info("Deposit action triggered", { gardenId });
  };

  const handleCookieJar = (gardenId: string) => {
    logger.info("Cookie Jar action triggered", { gardenId });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-text-strong">
        {formatMessage({ id: "public.fund.title", defaultMessage: "Fund" })}
      </h1>
      <p className="mt-2 text-sm text-text-sub">
        {formatMessage({
          id: "public.fund.description",
          defaultMessage: "Support regenerative gardens by funding their vaults",
        })}
      </p>

      {/* Aggregate Stats — 2/3 stats + 1/3 positions placeholder */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-stroke-soft bg-bg-white p-4">
          <p className="text-xs text-text-soft">
            {formatMessage({
              id: "public.fund.totalGardens",
              defaultMessage: "Total Gardens",
            })}
          </p>
          <p className="mt-1 text-2xl font-bold text-text-strong">{gardens.length}</p>
        </div>
        <div className="rounded-xl border border-stroke-soft bg-bg-white p-4">
          <p className="text-xs text-text-soft">
            {formatMessage({
              id: "public.fund.totalGardeners",
              defaultMessage: "Total Gardeners",
            })}
          </p>
          <p className="mt-1 text-2xl font-bold text-text-strong">{totalGardeners}</p>
        </div>
      </div>

      {/* Garden Gallery with Deposit + Cookie Jar buttons */}
      {isLoading ? (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-bg-weak animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {gardens.map((garden) => (
            <div key={garden.id} className="rounded-xl border border-stroke-soft bg-bg-white p-4">
              {garden.bannerImage && (
                <img
                  src={garden.bannerImage}
                  alt=""
                  className="h-32 w-full rounded-lg object-cover"
                />
              )}
              <h3
                className="mt-3 text-base font-semibold text-text-strong truncate"
                title={garden.name}
              >
                {garden.name}
              </h3>
              <p className="mt-1 text-sm text-text-sub line-clamp-2">{garden.description}</p>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDeposit(garden.id)}
                  className="flex-1 rounded-lg bg-primary-base px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark active:scale-95"
                >
                  {formatMessage({
                    id: "public.fund.deposit",
                    defaultMessage: "Deposit",
                  })}
                </button>
                <button
                  type="button"
                  onClick={() => handleCookieJar(garden.id)}
                  className="flex-1 rounded-lg border border-stroke-soft bg-bg-white px-3 py-2 text-sm font-medium text-text-strong transition-colors hover:bg-bg-weak active:scale-95"
                >
                  {formatMessage({
                    id: "public.fund.cookieJar",
                    defaultMessage: "Cookie Jar",
                  })}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
