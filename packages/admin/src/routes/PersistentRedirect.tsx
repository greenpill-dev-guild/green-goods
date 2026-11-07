import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * A redirect that keeps trying until it lands. As a cockpit page arrives, the garden sync writes
 * `gardenId` into its address, and that write cancels a redirect whose route is still loading.
 * `<Navigate>` with a fixed target never tries again and leaves a blank page, so this one
 * redirects again each time the address changes under it.
 */
export default function PersistentRedirect({ to }: { to: string }) {
  const navigate = useNavigate();
  const { key } = useLocation();

  useEffect(() => {
    navigate(to, { replace: true });
  }, [key, navigate, to]);

  return null;
}
