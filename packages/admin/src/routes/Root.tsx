import { ToastViewport } from "@green-goods/shared";
import { Outlet } from "react-router-dom";

export default function Root() {
  return (
    <>
      <Outlet />
      <ToastViewport />
    </>
  );
}
