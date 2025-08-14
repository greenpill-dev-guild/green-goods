import { z } from "zod";

export const WorkSessionSchema = z.object({
  actionType: z.enum(["planting", "invasive_removal", "watering", "litter_cleanup", "harvesting"]),
  description: z.string().min(5).max(600),
  location: z.string().optional(),
  materialsUsed: z.array(z.string()).default([]),
  photos: z
    .array(
      z.object({
        type: z.enum(["before", "after"]),
        cid: z.string().min(10),
      })
    )
    .min(1),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  notes: z.string().optional(),
  lang: z.enum(["en", "es", "pt"]).default("en"),
  aiAssisted: z.literal(true).default(true),
});
export type WorkSession = z.infer<typeof WorkSessionSchema>;
