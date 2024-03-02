import React from "react";

import { ContributeDataProps } from "../../hooks/views/useContribute";
import { Button } from "@/components/ui/button";
import { CircleLoader } from "@/components/Loader/Circle";

interface ContributeProps extends ContributeDataProps {}

const Contribute: React.FC<ContributeProps> = ({
  isIdle,
  isDetails,
  isCampaign,
  isReview,
  isUploading,
  isAttesting,
  isAttested,
  campaigns,
  setDetails,
  setCampaign,
  attestContribution,
  back,
  cancel,
  contributeMore,
  goHome,
  error,
  info,
}) => {
  // const { campaign, capitals, description, media, title, value } = info;

  function onSubmit();

  return (
    <section className="flex flex-col w-full h-full items-center gap-3 px-6 text-center">
      <form>
        <div>
          {isIdle ? null : isDetails ? (
            <div>Details</div>
          ) : isCampaign ? (
            <div>
              <ul>
                {campaigns.map((campaign) => (
                  <li key={campaign.id}>
                    <div>{campaign.title}</div>
                    <div>{campaign.description}</div>
                  </li>
                ))}
              </ul>
            </div>
          ) : isReview ? (
            <div>
              <div>Proof</div>
              <img src="" alt="" />
              <div>Title</div>
              <div>Description</div>
              <div>Capitals</div>
              <div>Value</div>
            </div>
          ) : isUploading ? (
            <div className="grid place-items-center w-full h-full">
              <CircleLoader />
              <p>Uploading Image</p>
            </div>
          ) : isAttesting ? (
            <div>
              <CircleLoader />
              <p>Attesting Contribution</p>
            </div>
          ) : isAttested ? (
            <div>
              <div>Proof</div>
              <img src="" alt="" />
              <div>Title</div>
              <div>Description</div>
              <div>Value</div>
            </div>
          ) : null}
        </div>
        <div className="flex justify-between w-100">
          <Button>
            {isIdle ? null : isDetails ? (
              <div>Cancel</div>
            ) : isCampaign ? (
              <div>Back</div>
            ) : isReview ? (
              <div>Back</div>
            ) : isUploading ? (
              <div>Back</div>
            ) : isAttesting ? (
              <div>Back</div>
            ) : isAttested ? (
              <div>Go Home</div>
            ) : null}
          </Button>
          <Button
            onClick={
              isIdle ? null : isDetails ? (
                ne
              ) : isCampaign ? (
                <div>Next</div>
              ) : isReview ? (
                <div>Contribute</div>
              ) : isUploading ? (
                <div>Contribute</div>
              ) : isAttesting ? (
                <div>Contribute</div>
              ) : isAttested ? (
                <div>Attested</div>
              ) : null
            }
          >
            {isIdle ? null : isDetails ? (
              <div>Next</div>
            ) : isCampaign ? (
              <div>Next</div>
            ) : isReview ? (
              <div>Contribute</div>
            ) : isUploading ? (
              <div>Contribute</div>
            ) : isAttesting ? (
              <div>Contribute</div>
            ) : isAttested ? (
              <div>Attested</div>
            ) : null}
          </Button>
        </div>
      </form>
    </section>
  );
};

export default Contribute;
