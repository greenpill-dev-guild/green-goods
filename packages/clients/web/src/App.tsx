import { Toaster } from "react-hot-toast";

import { Appbar } from "./components/Layout/AppBar";
import { Header } from "./components/Layout/Header";
import { Navigation } from "./components/Layout/Navigation";

import Views from "./views";

export function App() {
  return (
    <>
      <Header />
      <Navigation />
      <Views />
      <Appbar />
      <Toaster />
    </>
  );
}
