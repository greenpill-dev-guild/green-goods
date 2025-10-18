import { useNavigate } from "react-router-dom";

/** Navigates to a route after resetting the main scroll container to the top. */
export const useNavigateToTop = () => {
  const navigate = useNavigate();

  const navigateToTop = async (path: string) => {
    const el = document.getElementById("app-scroll");
    if (el) {
      el.scrollTop = 0;
    } else {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    navigate(path);
  };

  return navigateToTop;
};
