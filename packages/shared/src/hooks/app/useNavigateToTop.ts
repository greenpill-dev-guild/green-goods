import { type NavigateOptions, useNavigate } from "react-router-dom";

export interface NavigateToTopOptions extends NavigateOptions {
  /** Enable view transition animation. Defaults to true. */
  viewTransition?: boolean;
}

/**
 * Navigates to a route after resetting the main scroll container to the top.
 * Supports React Router v7+ view transitions.
 *
 * @example
 * ```tsx
 * const navigate = useNavigateToTop();
 *
 * // Navigate with view transition (default)
 * navigate('/home');
 *
 * // Navigate without view transition
 * navigate('/home', { viewTransition: false });
 *
 * // Navigate with state
 * navigate('/garden', { state: { from: 'home' } });
 * ```
 */
export const useNavigateToTop = () => {
  const navigate = useNavigate();

  const navigateToTop = (path: string, options: NavigateToTopOptions = {}): void => {
    // Reset scroll position
    const el = document.getElementById("app-scroll");
    if (el) {
      el.scrollTop = 0;
    } else {
      window.scrollTo({ top: 0, behavior: "auto" });
    }

    // Default to enabling view transitions
    const { viewTransition = true, ...restOptions } = options;

    navigate(path, {
      ...restOptions,
      viewTransition,
    });
  };

  return navigateToTop;
};
