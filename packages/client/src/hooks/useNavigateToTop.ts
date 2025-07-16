import { useNavigate } from "react-router-dom";

export const useNavigateToTop = () => {
  const navigate = useNavigate();

  const navigateToTop = async (path: string) => {
    window.scrollTo({ top: 0, behavior: "instant" });
    navigate(path);
  };

  return navigateToTop;
};
