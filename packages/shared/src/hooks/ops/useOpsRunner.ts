import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type {
  OpsDeployRequest,
  OpsJob,
  OpsJobLogsState,
  OpsRunScriptRequest,
  OpsRunnerChallengeResponse,
  OpsRunnerHealth,
  OpsRunnerJobResponse,
  OpsRunnerJobsResponse,
  OpsRunnerScriptDefinition,
  OpsRunnerScriptsResponse,
  OpsRunnerSession,
  OpsRunnerVerifyResponse,
  OpsUpgradeRequest,
} from "../../types/ops";

const OPS_SESSION_STORAGE_KEY = "green_goods_ops_runner_session";
const OPS_SESSION_EVENT = "gg:ops-runner-session";
const DEFAULT_OPS_RUNNER_URL = "http://127.0.0.1:8787";

export function getOpsRunnerBaseUrl(): string {
  const configured = import.meta.env.VITE_OPS_RUNNER_URL?.trim();
  if (!configured) return DEFAULT_OPS_RUNNER_URL;
  return configured.replace(/\/$/, "");
}

function readSessionFromStorage(): OpsRunnerSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(OPS_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OpsRunnerSession;
  } catch {
    return null;
  }
}

function writeSessionToStorage(session: OpsRunnerSession | null): void {
  if (typeof window === "undefined") return;

  if (!session) {
    window.localStorage.removeItem(OPS_SESSION_STORAGE_KEY);
  } else {
    window.localStorage.setItem(OPS_SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  window.dispatchEvent(new Event(OPS_SESSION_EVENT));
}

async function opsRequest<T>(args: {
  baseUrl: string;
  path: string;
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
}): Promise<T> {
  const headers = new Headers();
  if (args.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (args.token) {
    headers.set("Authorization", `Bearer ${args.token}`);
  }

  const response = await fetch(`${args.baseUrl}${args.path}`, {
    method: args.method ?? "GET",
    headers,
    body: args.body !== undefined ? JSON.stringify(args.body) : undefined,
  });

  const responseText = await response.text();
  let parsed: unknown = null;

  try {
    parsed = responseText ? JSON.parse(responseText) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const errorMessage =
      parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : `Ops runner request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return parsed as T;
}

function isSessionValid(session: OpsRunnerSession | null): boolean {
  if (!session) return false;
  return new Date(session.expiresAt).getTime() > Date.now();
}

export function useOpsRunnerSession() {
  const [session, setSession] = useState<OpsRunnerSession | null>(() => readSessionFromStorage());

  const refreshSession = useCallback(() => {
    setSession(readSessionFromStorage());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.addEventListener("storage", refreshSession);
    window.addEventListener(OPS_SESSION_EVENT, refreshSession as EventListener);

    return () => {
      window.removeEventListener("storage", refreshSession);
      window.removeEventListener(OPS_SESSION_EVENT, refreshSession as EventListener);
    };
  }, [refreshSession]);

  const saveSession = useCallback((nextSession: OpsRunnerSession) => {
    writeSessionToStorage(nextSession);
    setSession(nextSession);
  }, []);

  const clearSession = useCallback(() => {
    writeSessionToStorage(null);
    setSession(null);
  }, []);

  useEffect(() => {
    if (!session) return;
    if (isSessionValid(session)) return;
    clearSession();
  }, [session, clearSession]);

  return {
    session,
    isAuthenticated: isSessionValid(session),
    saveSession,
    clearSession,
  };
}

export function useOpsRunnerHealth(): UseQueryResult<OpsRunnerHealth, Error> {
  const baseUrl = getOpsRunnerBaseUrl();

  return useQuery({
    queryKey: ["ops-runner", "health", baseUrl],
    queryFn: () => opsRequest<OpsRunnerHealth>({ baseUrl, path: "/health" }),
    refetchInterval: 15_000,
  });
}

export function useOpsRunnerAuth() {
  const baseUrl = getOpsRunnerBaseUrl();
  const { saveSession, clearSession } = useOpsRunnerSession();

  const challengeMutation = useMutation({
    mutationFn: ({ address }: { address: string }) =>
      opsRequest<OpsRunnerChallengeResponse>({
        baseUrl,
        path: "/auth/challenge",
        method: "POST",
        body: { address },
      }),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ address, signature }: { address: string; signature: string }) =>
      opsRequest<OpsRunnerVerifyResponse>({
        baseUrl,
        path: "/auth/verify",
        method: "POST",
        body: { address, signature },
      }),
    onSuccess: (response) => {
      saveSession({
        token: response.token,
        address: response.address,
        expiresAt: response.expiresAt,
      });
    },
  });

  return {
    requestChallenge: challengeMutation,
    verifySignature: verifyMutation,
    signOut: clearSession,
  };
}

export function useOpsRunnerScripts() {
  const baseUrl = getOpsRunnerBaseUrl();
  const { session, isAuthenticated } = useOpsRunnerSession();

  return useQuery({
    queryKey: ["ops-runner", "scripts", baseUrl, session?.address],
    queryFn: async () => {
      const response = await opsRequest<OpsRunnerScriptsResponse>({
        baseUrl,
        path: "/scripts",
        token: session?.token,
      });
      return response.scripts as OpsRunnerScriptDefinition[];
    },
    enabled: isAuthenticated && !!session?.token,
    staleTime: 60_000,
  });
}

export function useOpsRunnerJobs(options?: { enabled?: boolean; refetchIntervalMs?: number }) {
  const baseUrl = getOpsRunnerBaseUrl();
  const { session, isAuthenticated } = useOpsRunnerSession();

  return useQuery({
    queryKey: ["ops-runner", "jobs", baseUrl, session?.address],
    queryFn: async () => {
      const response = await opsRequest<OpsRunnerJobsResponse>({
        baseUrl,
        path: "/jobs",
        token: session?.token,
      });
      return response.jobs;
    },
    enabled: (options?.enabled ?? true) && isAuthenticated && !!session?.token,
    refetchInterval: options?.refetchIntervalMs ?? 3_000,
  });
}

export function useOpsRunnerJob(jobId: string | null, options?: { enabled?: boolean }) {
  const baseUrl = getOpsRunnerBaseUrl();
  const { session, isAuthenticated } = useOpsRunnerSession();

  return useQuery({
    queryKey: ["ops-runner", "job", baseUrl, session?.address, jobId],
    queryFn: async () => {
      const response = await opsRequest<OpsRunnerJobResponse>({
        baseUrl,
        path: `/jobs/${jobId}`,
        token: session?.token,
      });
      return response.job;
    },
    enabled: (options?.enabled ?? true) && !!jobId && isAuthenticated && !!session?.token,
    refetchInterval: 2_000,
  });
}

function useOpsRunnerJobMutation<TPayload>(path: string) {
  const baseUrl = getOpsRunnerBaseUrl();
  const { session, isAuthenticated } = useOpsRunnerSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TPayload) => {
      if (!isAuthenticated || !session?.token) {
        throw new Error("Ops runner session is not authenticated");
      }

      const response = await opsRequest<OpsRunnerJobResponse>({
        baseUrl,
        path,
        method: "POST",
        body: payload,
        token: session.token,
      });

      return response.job;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ops-runner", "jobs"] });
    },
  });
}

export function useOpsDeployPlan() {
  return useOpsRunnerJobMutation<OpsDeployRequest>("/deploy/plan");
}

export function useOpsFinalizeDeploy() {
  return useOpsRunnerJobMutation<OpsDeployRequest>("/deploy/finalize");
}

export function useOpsUpgradePlan() {
  return useOpsRunnerJobMutation<OpsUpgradeRequest>("/upgrade/plan");
}

export function useOpsFinalizeUpgrade() {
  return useOpsRunnerJobMutation<OpsUpgradeRequest>("/upgrade/finalize");
}

export function useOpsRunScript() {
  return useOpsRunnerJobMutation<OpsRunScriptRequest>("/scripts/run");
}

export function useOpsJobLogs(
  jobId: string | null,
  options?: { enabled?: boolean; maxLogs?: number }
): OpsJobLogsState {
  const baseUrl = getOpsRunnerBaseUrl();
  const { session, isAuthenticated } = useOpsRunnerSession();
  const [state, setState] = useState<OpsJobLogsState>({
    logs: [],
    status: null,
    connected: false,
    error: null,
  });

  useEffect(() => {
    const isEnabled = options?.enabled ?? true;
    if (!isEnabled || !jobId || !isAuthenticated || !session?.token) return;
    if (typeof EventSource === "undefined") {
      setState((current) => ({
        ...current,
        error: "EventSource is not available in this environment",
      }));
      return;
    }

    setState({ logs: [], status: null, connected: false, error: null });

    const sourceUrl = new URL(`/jobs/${jobId}/logs`, baseUrl);
    sourceUrl.searchParams.set("token", session.token);
    const eventSource = new EventSource(sourceUrl.toString());

    eventSource.onopen = () => {
      setState((current) => ({ ...current, connected: true, error: null }));
    };

    const onLog = (event: Event) => {
      const messageEvent = event as MessageEvent<string>;
      try {
        const entry = JSON.parse(messageEvent.data);
        setState((current) => {
          const maxLogs = options?.maxLogs ?? 1_500;
          const nextLogs = [...current.logs, entry].slice(-maxLogs);
          return {
            ...current,
            logs: nextLogs,
          };
        });
      } catch {
        // Ignore malformed log events
      }
    };

    const onStatus = (event: Event) => {
      const messageEvent = event as MessageEvent<string>;
      try {
        const payload = JSON.parse(messageEvent.data);
        const nextStatus = payload.job ? payload.job : payload;
        setState((current) => ({
          ...current,
          status: nextStatus as OpsJob,
        }));
      } catch {
        // Ignore malformed status events
      }
    };

    eventSource.addEventListener("log", onLog as EventListener);
    eventSource.addEventListener("status", onStatus as EventListener);
    eventSource.addEventListener("done", onStatus as EventListener);

    eventSource.onerror = () => {
      setState((current) => ({
        ...current,
        connected: false,
        error: "Live log connection interrupted",
      }));
    };

    return () => {
      eventSource.removeEventListener("log", onLog as EventListener);
      eventSource.removeEventListener("status", onStatus as EventListener);
      eventSource.removeEventListener("done", onStatus as EventListener);
      eventSource.close();
    };
  }, [baseUrl, isAuthenticated, jobId, options?.enabled, options?.maxLogs, session?.token]);

  return state;
}
