import { CAMPAIGN_DESCRIPTION_MAX_LENGTH } from "@green-goods/shared/utils/cookie-jar-campaign";
import { AdminTextArea, AdminTextField } from "@/components/AdminTextField";
import type { CampaignCookieJarCreateFormProps } from "./CampaignCookieJarCreateForm.types";
import { CampaignImageInput } from "./CampaignImageInput";

export function CampaignDetailsSection(props: CampaignCookieJarCreateFormProps) {
  const {
    formatMessage,
    campaignTitle,
    setCampaignTitle,
    campaignDescription,
    setCampaignDescription,
    campaignImage,
    setCampaignImage,
    campaignImageFile,
    setCampaignImageFile,
    createPending,
    publicCampaignUrl,
  } = props;
  return (
    <section>
      <div className="grid gap-4">
        <AdminTextField
          id="campaign-cookie-jar-title"
          label={formatMessage({
            id: "cockpit.community.cookies.campaignName",
            defaultMessage: "Campaign name",
          })}
          value={campaignTitle}
          onChange={(event) => setCampaignTitle(event.target.value)}
        />
        <AdminTextArea
          id="campaign-cookie-jar-description"
          label={formatMessage({
            id: "cockpit.community.cookies.campaignDescription",
            defaultMessage: "Campaign description",
          })}
          value={campaignDescription}
          onChange={(event) => setCampaignDescription(event.target.value)}
          showCount
          textareaProps={{ maxLength: CAMPAIGN_DESCRIPTION_MAX_LENGTH }}
        />
        <CampaignImageInput
          value={campaignImage}
          onChange={setCampaignImage}
          file={campaignImageFile}
          onFileChange={setCampaignImageFile}
          disabled={createPending}
          source="campaign-cookie-jar-create-image"
        />
        <div className="rounded-[var(--m3-shape-md)] border border-stroke-soft bg-bg-white-0 p-3">
          <p className="text-label-md text-text-strong">
            {formatMessage({
              id: "cockpit.community.cookies.generatedCampaignLink",
              defaultMessage: "Campaign page",
            })}
          </p>
          <p className="mt-1 break-all text-body-sm text-text-sub">{publicCampaignUrl}</p>
        </div>
      </div>
    </section>
  );
}
