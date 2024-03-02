import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

import { MultiSelect } from "../ui/multi-select";
import { useState } from "react";

const capitals: Capital[] = [
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
  title: z.string().min(2, {
    message: "Title must be at least 2 characters long.",
  }),
  description: z.string().max(1000, {
    message: "Description must be at most 1000 characters long.",
  }),
  details: z.string().url(),
  capitals: z.array(z.string()),
  value: z.number(),
  image: z.instanceof(File),
});

export const ContributionForm = () => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      capitals: [],
      details: "",
    },
  });

  const [preview, setPreview] = useState<string | null>(null);

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

  // 2. Define a submit handler.
  function onSubmit(values: z.infer<typeof formSchema>) {
    // Do something with the form values.
    // ✅ This will be type-safe and validated.
    console.log(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="shadcn" {...field} />
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
                <Input placeholder="shadcn" {...field} />
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
              <FormLabel>Username</FormLabel>
              <FormControl>
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
                  options={capitals.map((capital) => ({
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
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
};
