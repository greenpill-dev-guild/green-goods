import { APP_NAME } from "@green-goods/shared/config/app";

/**
 * Header for reporting ceremony pages: the mark on a solid canvas and nothing else. There is no
 * navigation or install action, so nothing competes with the one step the person came to finish,
 * and nothing leads away from a signature in progress.
 */
export function FocusedSiteHeader() {
  return (
    <header className="border-b border-stroke-soft-200 bg-bg-white-0" data-variant="focused">
      <div className="px-6 sm:px-10">
        <div className="mx-auto flex h-16 max-w-7xl items-center">
          <img src="/icon.png" alt={APP_NAME} className="h-8 w-auto" />
        </div>
      </div>
    </header>
  );
}
