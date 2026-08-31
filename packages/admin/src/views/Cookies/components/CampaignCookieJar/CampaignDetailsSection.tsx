import { AdminTextArea, AdminTextField } from "@/components/AdminTextField";
import type { CampaignCookieJarCreateFormProps } from "./CampaignCookieJarCreateForm";
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
    <section className="surface-section overflow-visible">
      <div className="mb-4">
        <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">01</p>
        <h2 className="text-title-md font-semibold text-[rgb(var(--m3-on-surface))]">
          {formatMessage({
            id: "cockpit.community.cookies.createCampaignSection",
            defaultMessage: "Campaign",
          })}
        </h2>
      </div>
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
        />
        <CampaignImageInput
          value={campaignImage}
          onChange={setCampaignImage}
          file={campaignImageFile}
          onFileChange={setCampaignImageFile}
          disabled={createPending}
          source="campaign-cookie-jar-create-image"
        />
        <div className="rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface))] p-3">
          <p className="text-label-md text-[rgb(var(--m3-on-surface))]">
            {formatMessage({
              id: "cockpit.community.cookies.generatedCampaignLink",
              defaultMessage: "Campaign page",
            })}
          </p>
          <p className="mt-1 break-all text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
            {publicCampaignUrl}
          </p>
        </div>
      </div>
    </section>
  );
}
