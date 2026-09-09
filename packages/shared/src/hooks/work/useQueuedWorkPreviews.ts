import { useEffect, useMemo, useState, useRef } from "react";
import type { Job } from "../../types/job-queue";
import { jobQueueDB } from "../../modules/job-queue/db";
import { useWorkPreviewUrls } from "./useWorkImages";

export function useQueuedWorkPreviews(jobs: Job[]) {
  const [loaded, setLoaded] = useState<Array<{ jobId: string; file: File }>>([]);
  const jobIds = jobs.map((job) => job.id).join(":");
  const latestJobs = useRef(jobs);
  latestJobs.current = jobs;
  useEffect(() => {
    let active = true;
    void Promise.all(
      latestJobs.current.map(async (job) => {
        const images = await jobQueueDB.getImagesForJob(job.id);
        return images.map(({ file }) => ({ jobId: job.id, file }));
      })
    )
      .then((items) => {
        if (active) setLoaded(items.flat());
      })
      .catch(() => {
        if (active) setLoaded([]);
      });
    return () => {
      active = false;
    };
  }, [jobIds]);
  const files = useMemo(() => loaded.map((item) => item.file), [loaded]);
  const urls = useWorkPreviewUrls(files);
  return useMemo(() => {
    const result = new Map<string, string[]>();
    loaded.forEach((item, index) => {
      if (urls[index]) result.set(item.jobId, [...(result.get(item.jobId) ?? []), urls[index]]);
    });
    return result;
  }, [loaded, urls]);
}
