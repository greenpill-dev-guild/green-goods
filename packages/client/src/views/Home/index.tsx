import { useIntl } from "react-intl";
import { Await, Outlet, useLoaderData, useLocation } from "react-router-dom";
import { Suspense } from "react";

import { GardenCard } from "@/components/UI/Card/GardenCard";
import { GardenCardSkeleton } from "@/components/UI/Card/GardenCardSkeleton";

import { WorkDashboardIcon } from "@/components/UI/WorkDashboard/Icon";
import { useBrowserNavigation, useNavigateToTop } from "@/hooks";
import { CookieJarIcon } from "@/components/UI/CookieJar";

const Gardens: React.FC = () => {
  const navigate = useNavigateToTop();
  const location = useLocation();
  const loaderData = useLoaderData() as { actions: Promise<Action[]>; gardens: Promise<Garden[]> };
  const intl = useIntl();

  // Ensure proper re-rendering on browser navigation
  useBrowserNavigation();

  function handleCardClick(id: string) {
    navigate(`/home/${id}`);
    document.getElementsByTagName("article")[0].scrollIntoView();
  }

  const GardensList = () => (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <GardenCardSkeleton key={idx} media="large" height="home" />
          ))}
        </div>
      }
    >
      <Await
        resolve={loaderData.gardens}
        errorElement={
          <p className="grid place-items-center text-sm italic">
            {intl.formatMessage({
              id: "app.home.messages.errorLoadingGardens",
              description: "Error loading gardens",
            })}
          </p>
        }
      >
        {(gardensResolved: Garden[]) =>
          gardensResolved.length ? (
            gardensResolved.map((garden) => (
              <GardenCard
                key={garden.id}
                garden={garden}
                media="large"
                height="home"
                showOperators={true}
                selected={garden.id === location.pathname.split("/")[2]}
                {...garden}
                onClick={() => handleCardClick(garden.id)}
              />
            ))
          ) : (
            <p className="grid place-items-center text-sm italic">
              {intl.formatMessage({
                id: "app.home.messages.noGardensFound",
                description: "No gardens found",
              })}
            </p>
          )
        }
      </Await>
    </Suspense>
  );

  return (
    <article className={"mb-6"}>
      {location.pathname === "/home" ? (
        <>
          <div className="flex justify-between items-center w-full py-6 px-4 sm:px-6 md:px-12">
            <h4 className="font-semibold flex-1">{intl.formatMessage({ id: "app.home" })}</h4>
            <div className="flex-shrink-0 ml-4 flex items-center gap-2">
              <CookieJarIcon />
              <WorkDashboardIcon />
            </div>
          </div>
          <div className={"padded flex-1 flex flex-col gap-4 overflow-y-scroll"}>
            <GardensList />
          </div>
        </>
      ) : null}
      <Outlet />
    </article>
  );
};

export default Gardens;
