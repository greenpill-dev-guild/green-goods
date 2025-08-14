import type { LoaderFunctionArgs } from "react-router-dom";
import { queryClient } from "@/modules/react-query";
import { getGardens, getActions } from "@/modules/greengoods";
import { getGardenAssessments } from "@/modules/eas";

export async function gardenRouteLoader({ params }: LoaderFunctionArgs) {
  const gardenId = params.id as string;

  await queryClient.ensureQueryData({ queryKey: ["gardens"], queryFn: () => getGardens() });
  await queryClient.ensureQueryData({ queryKey: ["actions"], queryFn: () => getActions() });

  const gardens = queryClient.getQueryData<Garden[]>(["gardens"]) || [];
  const garden = gardens.find((g) => g.id === gardenId);
  if (!garden) throw new Response("Garden not found", { status: 404 });

  const assessments = await queryClient.ensureQueryData({
    queryKey: ["assessments", gardenId],
    queryFn: () => getGardenAssessments(gardenId),
  });

  return { garden: { ...garden, assessments } } as const;
}
