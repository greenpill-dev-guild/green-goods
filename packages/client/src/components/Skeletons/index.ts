/**
 * Route-level Skeleton Components
 *
 * These skeletons are designed to be used as Suspense fallbacks
 * for entire routes/pages. They match the layout of their
 * corresponding pages to provide smooth loading transitions.
 *
 * @example
 * import { Suspense } from 'react';
 * import { HomePageSkeleton } from '@/components/Skeletons';
 *
 * <Suspense fallback={<HomePageSkeleton />}>
 *   <HomeView />
 * </Suspense>
 */

export { HomePageSkeleton } from "./HomePageSkeleton";
export { GardenPageSkeleton } from "./GardenPageSkeleton";
export { ProfilePageSkeleton } from "./ProfilePageSkeleton";
