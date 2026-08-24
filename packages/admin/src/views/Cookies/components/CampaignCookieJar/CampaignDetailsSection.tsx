import { Textarea, TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { FormField } from "@green-goods/shared/components/Form/FormFieldWrapper";
import { CampaignImageInput } from "./CampaignImageInput";
import type { CampaignCookieJarCreateFormProps } from "./CampaignCookieJarCreateForm";

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
        <FormField
          label={formatMessage({
            id: "cockpit.community.cookies.campaignName",
            defaultMessage: "Campaign name",
          })}
          htmlFor="campaign-cookie-jar-title"
        >
          <TextInput
            id="campaign-cookie-jar-title"
            surface="admin"
            value={campaignTitle}
            onChange={(event) => setCampaignTitle(event.target.value)}
          />
        </FormField>
        <FormField
          label={formatMessage({
            id: "cockpit.community.cookies.campaignDescription",
            defaultMessage: "Campaign description",
          })}
          htmlFor="campaign-cookie-jar-description"
        >
          <Textarea
            id="campaign-cookie-jar-description"
            surface="admin"
            value={campaignDescription}
            onChange={(event) => setCampaignDescription(event.target.value)}
          />
        </FormField>
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
