import type { LoaderFunctionArgs } from "react-router-dom";
import { queryClient } from "@/modules/react-query";
import { getGardens, getActions } from "@/modules/greengoods";
import { getGardenAssessments, getWorks } from "@/modules/eas";
import { getFileByHash } from "@/modules/pinata";
import { jobQueueDB } from "@/modules/job-queue";
import { jobToWork } from "@/hooks/useWorks";

export async function workRouteLoader({ params }: LoaderFunctionArgs) {
  const gardenId = params.id as string;
  const workId = params.workId as string;

  // Ensure base data is cached
  const chainIdKey = ["gardens"];
  await queryClient.ensureQueryData({ queryKey: chainIdKey, queryFn: () => getGardens() });
  const actions = await queryClient.ensureQueryData({
    queryKey: ["actions"],
    queryFn: () => getActions(),
  });

  // Resolve garden and assessments
  const garden = (await queryClient.getQueryData<Garden[]>(chainIdKey))?.find(
    (g) => g.id === gardenId
  );
  if (!garden) throw new Response("Garden not found", { status: 404 });
  const assessmentsPromise = queryClient.ensureQueryData({
    queryKey: ["assessments", gardenId],
    queryFn: () => getGardenAssessments(gardenId),
  });

  // Fetch works for this garden and resolve the requested work; fallback to local job when offline
  const works = await getWorks(gardenId);
  let work = works.find((w) => w.id === workId);
  let workMetadata: WorkMetadata | null = null;
  let actionTitle: string | null = null;

  if (work) {
    const w = work;
    workMetadata = w.metadata
      ? await getFileByHash(work.metadata)
          .then((r) => r.data as unknown as WorkMetadata)
          .catch(() => null)
      : null;
    if (typeof w.actionUID === "number") {
      const found = actions.find((a) => {
        const idPart = String(a.id).split("-").pop();
        const num = Number(idPart);
        return Number.isFinite(num) && num === w.actionUID;
      });
      actionTitle = found?.title ?? null;
    } else {
      actionTitle = null;
    }
  } else {
    // Try local offline job by id
    const job = await jobQueueDB.getJob(workId);
    if (!job || job.kind !== "work") {
      throw new Response("Work not found", { status: 404 });
    }
    const localWork = jobToWork(job as Job<WorkJobPayload>);
    const images = await jobQueueDB.getImagesForJob(job.id);
    localWork.media = images.map((img) => img.url);
    work = localWork;

    // Lookup action title from actions list
    const found = actions.find((a) => {
      const idPart = String(a.id).split("-").pop();
      const num = Number(idPart);
      return Number.isFinite(num) && num === (localWork.actionUID || 0);
    });
    actionTitle = found?.title ?? null;

    // Build local metadata approximation
    const payload = job.payload as any;
    workMetadata = {
      plantSelection: payload?.plantSelection || [],
      plantCount: typeof payload?.plantCount === "number" ? payload.plantCount : 0,
    } as WorkMetadata;
  }

  // Resolve garden before returning; expose workMetadata as a promise for Suspense/Await
  const resolvedGarden = await queryClient.ensureQueryData({
    queryKey: ["assessed-garden", gardenId],
    queryFn: async () => ({ ...garden, assessments: await assessmentsPromise }),
  });

  return {
    garden: resolvedGarden,
    work,
    workMetadata,
    actionTitle,
  } as const;
}
