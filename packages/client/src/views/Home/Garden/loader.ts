import type { LoaderFunctionArgs } from "react-router-dom";
import { queryClient } from "@/modules/react-query";
import { getGardens, getActions } from "@/modules/greengoods";
import { getGardenAssessments, getWorks } from "@/modules/eas";
import { getFileByHash } from "@/modules/pinata";

export async function workRouteLoader({ params }: LoaderFunctionArgs) {
  const gardenId = params.id as string;
  const workId = params.workId as string;

  // Ensure base data is cached
  const chainIdKey = ["gardens"];
  await queryClient.ensureQueryData({ queryKey: chainIdKey, queryFn: () => getGardens() });
  const actionsPromise = queryClient.ensureQueryData({
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

  // Fetch works for this garden and resolve the requested work
  const works = await getWorks(gardenId);
  const work = works.find((w) => w.id === workId);
  const metaPromise: WorkMetadata | null = work?.metadata
    ? await getFileByHash(work.metadata)
        .then((r) => r.data as unknown as WorkMetadata)
        .catch(() => null)
    : null;
  const actions = await actionsPromise;
  const actionTitle = (() => {
    if (!work?.actionUID) return null;
    const found = actions.find((a) => {
      const idPart = String(a.id).split("-").pop();
      const num = Number(idPart);
      return Number.isFinite(num) && num === work.actionUID;
    });
    return found?.title ?? null;
  })();

  // Streaming: return promises where useful (no defer needed)
  return {
    garden: queryClient.ensureQueryData({
      queryKey: ["assessed-garden", gardenId],
      queryFn: async () => ({ ...garden, assessments: await assessmentsPromise }),
    }),
    work,
    workMetadata: Promise.resolve(metaPromise),
    actionTitle,
  } as const;
}
