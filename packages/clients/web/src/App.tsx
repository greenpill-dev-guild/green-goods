import { Toaster } from "react-hot-toast";

import { Header } from "./components/Layout/Header";

import Views from "./views";

export function App() {
  return (
    <>
      <Header />
      <Views />
      <Toaster />
    </>
  );
}
