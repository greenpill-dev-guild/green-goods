import { toastService } from "@green-goods/shared";
import { useEffect } from "react";
import { useIntl } from "react-intl";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";

// ── Simple redirects (no param parsing needed) ──────────────────────────────

export function DashboardRedirect() {
  return <Navigate to="/work" replace />;
}

export function GardensListRedirect() {
  return <Navigate to="/garden" replace />;
}

export function AssessmentsRedirect() {
  return <Navigate to="/garden?view=impact" replace />;
}

export function EndowmentsRedirect() {
  return <Navigate to="/community?card=treasury" replace />;
}

export function GardensCreateRedirect() {
  return <Navigate to="/gardens/create" replace />;
}

// ── Redirects with toast messages ───────────────────────────────────────────

export function ContractsRedirect() {
  const navigate = useNavigate();
  const intl = useIntl();

  useEffect(() => {
    toastService.info({
      message: intl.formatMessage({
        id: "legacy.redirect.compatibilityRoute",
        defaultMessage: "This page is no longer part of the cockpit.",
      }),
    });
    navigate("/work", { replace: true });
  }, [navigate, intl]);

  return null;
}

export function DeploymentRedirect() {
  const navigate = useNavigate();
  const intl = useIntl();

  useEffect(() => {
    toastService.info({
      message: intl.formatMessage({
        id: "legacy.redirect.compatibilityRoute",
        defaultMessage: "This page is no longer part of the cockpit.",
      }),
    });
    navigate("/work", { replace: true });
  }, [navigate, intl]);

  return null;
}

// ── Complex param-parsing redirects ─────────────────────────────────────────

/**
 * /gardens/:id -> /garden?garden=:id
 * Parses ?tab=X: work->/work, community->/community, else->/garden
 */
export function GardenDetailRedirect() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const tab = new URLSearchParams(location.search).get("tab");

  if (tab === "work") {
    return <Navigate to={`/work?garden=${id}`} replace />;
  }
  if (tab === "community") {
    return <Navigate to={`/community?garden=${id}`} replace />;
  }
  return <Navigate to={`/garden?garden=${id}`} replace />;
}

/**
 * /gardens/:id/work/:workId -> /work?garden=:id&item=:workId
 */
export function GardenWorkDetailRedirect() {
  const { id, workId } = useParams<{ id: string; workId: string }>();
  return <Navigate to={`/work?garden=${id}&item=${workId}`} replace />;
}

/**
 * /gardens/:id/assessments -> /work?garden=:id&view=assessments
 */
export function GardenAssessmentsRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/work?garden=${id}&view=assessments`} replace />;
}

/**
 * /gardens/:id/assessments/create -> /work?garden=:id&action=create-assessment
 */
export function GardenCreateAssessmentRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/work?garden=${id}&action=create-assessment`} replace />;
}

/**
 * /gardens/:id/hypercerts -> /work?garden=:id&view=hypercerts
 */
export function GardenHypercertsRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/work?garden=${id}&view=hypercerts`} replace />;
}

/**
 * /gardens/:id/hypercerts/:hId -> /work?garden=:id&item=:hId
 */
export function GardenHypercertDetailRedirect() {
  const { id, hypercertId } = useParams<{ id: string; hypercertId: string }>();
  return <Navigate to={`/work?garden=${id}&item=${hypercertId}`} replace />;
}

/**
 * /gardens/:id/hypercerts/create -> /work?garden=:id&action=mint
 */
export function GardenCreateHypercertRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/work?garden=${id}&action=mint`} replace />;
}

/**
 * /gardens/:id/vault -> /community?garden=:id&card=treasury
 */
export function GardenVaultRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/community?garden=${id}&card=treasury`} replace />;
}

/**
 * /gardens/:id/strategies -> /community?garden=:id&card=treasury
 */
export function GardenStrategiesRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/community?garden=${id}&card=treasury`} replace />;
}

/**
 * /gardens/:id/signal-pool -> /community?garden=:id&card=pools
 */
export function GardenSignalPoolRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/community?garden=${id}&card=pools`} replace />;
}

/**
 * /gardens/:id/signal-pool/:type -> /community?garden=:id&card=pools&pool=:type
 */
export function GardenSignalPoolTypeRedirect() {
  const { id, poolType } = useParams<{ id: string; poolType: string }>();
  return <Navigate to={`/community?garden=${id}&card=pools&pool=${poolType}`} replace />;
}

/**
 * /gardens/:id/submit-work -> /work?garden=:id&action=submit
 */
export function GardenSubmitWorkRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/work?garden=${id}&action=submit`} replace />;
}

/**
 * /actions/:id -> /actions?item=:id
 */
export function ActionDetailRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/actions?item=${id}`} replace />;
}

/**
 * /actions/create -> /actions?action=create
 */
export function ActionCreateRedirect() {
  return <Navigate to="/actions?action=create" replace />;
}

/**
 * /actions/:id/edit -> /actions?item=:id&action=edit
 */
export function ActionEditRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/actions?item=${id}&action=edit`} replace />;
}
