import { APP_NAME } from "@green-goods/shared";

import type { LoadingState } from "@/components/Layout";

interface LoadingSplashProps {
  loadingState: LoadingState;
  message?: string;
}

const stateMessages: Record<LoadingState, string> = {
  welcome: "Welcome",
  "joining-garden": "Joining garden...",
  default: "Loading...",
};

export function LoadingSplash({ loadingState, message }: LoadingSplashProps) {
  const displayMessage = message || stateMessages[loadingState] || APP_NAME;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-white-0 px-4 pb-12 pt-[12vh]">
      <div className="flex w-full max-w-sm flex-col items-center">
        <div className="flex-shrink-0 mb-6">
          <img
            src="/icon.png"
            alt={APP_NAME}
            width={240}
            height={240}
            className="transition-opacity duration-300 animate-pulse"
          />
        </div>

        <div className="h-8 flex items-center justify-center mb-6">
          <h3 className="text-center font-bold text-primary transition-all duration-200">
            {displayMessage}
          </h3>
        </div>

        <div className="w-full flex flex-col items-center gap-3 h-[100px]">
          <div className="w-full h-10 flex items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}
