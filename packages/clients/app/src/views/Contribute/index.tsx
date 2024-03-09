import { z } from "zod";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ContributeDataProps } from "@/hooks/views/useContribute";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CircleLoader } from "@/components/Loader/Circle";
import { MultiSelect } from "@/components/ui/multi-select";

interface ContributeProps extends ContributeDataProps {}

const capitalOptions: Capital[] = [
  "Living",
  "Social",
  "Material",
  "Cultural",
  "Financial",
  "Intellectual",
  "Experiental",
  "Spiritual",
];

const formSchema = z.object({
  title: z.string(),
  description: z.string(),
  details: z.string().url(),
  capitals: z.array(z.string()),
  value: z.number(),
  image: z.instanceof(File),
  campaign: z.string().optional(),
});

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
  console.log(info);

  const [preview, setPreview] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: info?.title || "",
      description: info?.description || "",
      capitals: [],
      details: "",
      campaign: info?.campaign || "",
      value: info?.value || 0,
    },
  });

  async function handleImage(file: File | null) {
    if (!file) {
      return;
    }

    const url = URL.createObjectURL(file);

    if (url) {
      setPreview(url);

      const reader = new FileReader();
      reader.onloadend = () => {
        const image = reader.result;
        if (!image) {
          console.log("No image");
          return;
        }
      };
      reader.readAsDataURL(file);
    }
  }

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (isIdle) return;
    if (isDetails) return setDetails(values);
    if (isCampaign) return setCampaign(values.campaign ?? "");
    if (isReview) return attestContribution();
    if (isUploading) return;
    if (isAttesting) return;
    if (isAttested) return contributeMore();
  }

  return (
    <section className="flex flex-col w-full h-full items-center gap-3 px-6 text-center">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full h-full py-6 text-left"
        >
          <div>
            {isIdle ? null : isDetails ? (
              <div>
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Title" {...field} />
                      </FormControl>
                      <FormDescription>
                        This is your public display name.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Description" {...field} />
                      </FormControl>
                      <FormDescription>
                        This is your public display name.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="image"
                  render={({ field: { onChange } }) => (
                    <FormItem>
                      <FormControl>
                        <FormLabel>
                          <input
                            className="hidden"
                            type="file"
                            accept="image/*"
                            onChange={async (event) => {
                              if (event.target.files) {
                                onChange(event.target.files[0]);
                                await handleImage(event.target.files[0]);
                              }
                            }}
                            // disabled={detecting}
                          />
                        </FormLabel>
                      </FormControl>
                      <FormDescription>
                        This is your public display name.
                        {preview && (
                          <div>
                            <img src={preview} />
                          </div>
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="capitals"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <MultiSelect
                          onChange={field.onChange}
                          options={capitalOptions.map((capital) => ({
                            label: capital,
                            value: capital,
                          }))}
                          selectAll={false}
                          selected={field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        This is your public display name.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
          <p>{error}</p>
          <div className="flex justify-between w-100">
            <Button
              onClick={
                isIdle
                  ? undefined
                  : isDetails
                  ? cancel
                  : isCampaign
                  ? back
                  : isReview
                  ? back
                  : isUploading
                  ? back
                  : isAttesting
                  ? back
                  : isAttested
                  ? goHome
                  : undefined
              }
            >
              {isIdle
                ? null
                : isDetails
                ? "Cancel"
                : isCampaign
                ? "Back"
                : isReview
                ? "Back"
                : isUploading
                ? "Back"
                : isAttesting
                ? "Back"
                : isAttested
                ? "Go Home"
                : null}
            </Button>
            <Button type="submit" disabled={isAttesting || isUploading}>
              {isIdle
                ? null
                : isDetails
                ? "Next"
                : isCampaign
                ? "Next"
                : isReview
                ? "Contribute"
                : isUploading
                ? "Contribute"
                : isAttesting
                ? "Contribute"
                : isAttested
                ? "Contribute More"
                : null}
            </Button>
          </div>
        </form>
      </Form>
    </section>
  );
};

export default Contribute;
