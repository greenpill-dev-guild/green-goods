import { ToastViewport } from "@green-goods/shared";
import { Outlet } from "react-router-dom";

export default function Root() {
  return (
    <div className="overflow-x-hidden w-full h-full">
      <Outlet />
      <ToastViewport />
    </div>
  );
}
