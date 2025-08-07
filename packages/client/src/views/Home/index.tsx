import { useIntl } from "react-intl";
import { Outlet, useLocation } from "react-router-dom";

import { GardenCard } from "@/components/UI/Card/GardenCard";
import { BeatLoader } from "@/components/UI/Loader";
import { WorkDashboardIcon } from "@/components/UI/WorkDashboard/Icon";
import { useGardens } from "@/providers/garden";
import { useNavigateToTop, useBrowserNavigation } from "@/hooks";

const Gardens: React.FC = () => {
  const navigate = useNavigateToTop();
  const location = useLocation();
  const { gardens, gardensStatus } = useGardens();
  const intl = useIntl();

  // Ensure proper re-rendering on browser navigation
  useBrowserNavigation();

  function handleCardClick(id: string) {
    navigate(`/home/${id}`);
    document.getElementsByTagName("article")[0].scrollIntoView();
  }

  const GardensList = () => {
    switch (gardensStatus) {
      case "pending":
        return (
          <div className="flex w-full h-full items-center justify-center ">
            <BeatLoader />
          </div>
        );
      case "success":
        return gardens.length ? (
          gardens.map((garden) => (
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
        );
      case "error":
        return (
          <p className="grid place-items-center text-sm italic">
            {intl.formatMessage({
              id: "app.home.messages.errorLoadingGardens",
              description: "Error loading gardens",
            })}
          </p>
        );
    }
  };

  return (
    <article className={"mb-6"}>
      {location.pathname === "/home" ? (
        <>
          <div className="flex justify-between items-center w-full py-6 px-4 sm:px-6 md:px-12">
            <h4 className="font-semibold flex-1">{intl.formatMessage({ id: "app.home" })}</h4>
            <div className="flex-shrink-0 ml-4">
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
