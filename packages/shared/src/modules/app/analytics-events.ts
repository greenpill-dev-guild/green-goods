/**
 * Analytics Events Module
 *
 * Centralized definitions for all product funnel events.
 * Uses a generic tracker factory to reduce boilerplate.
 *
 * Event Naming Convention:
 * - snake_case for event names
 * - {domain}_{action}_{outcome} pattern
 * - e.g., auth_passkey_register_started, work_submission_success
 *
 * @module modules/app/analytics-events
 */

import { track } from "./posthog";

// ============================================================================
// TRACKER FACTORY
// ============================================================================

type AuthMode = "passkey" | "wallet" | null;
type MemberType = "gardener" | "operator";

/**
 * Converts camelCase object keys to snake_case for PostHog
 */
function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    result[snakeKey] = value;
  }
  return result;
}

/**
 * Creates a typed tracking function that automatically converts keys to snake_case
 */
function createTracker<T extends Record<string, unknown>>(eventName: string) {
  return (props: T) => track(eventName, toSnakeCase(props));
}

// ============================================================================
// EVENT NAMES
// ============================================================================

export const ANALYTICS_EVENTS = {
  // Auth
  AUTH_PASSKEY_REGISTER_STARTED: "auth_passkey_register_started",
  AUTH_PASSKEY_REGISTER_SUCCESS: "auth_passkey_register_success",
  AUTH_PASSKEY_REGISTER_FAILED: "auth_passkey_register_failed",
  AUTH_PASSKEY_LOGIN_STARTED: "auth_passkey_login_started",
  AUTH_PASSKEY_LOGIN_SUCCESS: "auth_passkey_login_success",
  AUTH_PASSKEY_LOGIN_FAILED: "auth_passkey_login_failed",
  AUTH_WALLET_CONNECT_STARTED: "auth_wallet_connect_started",
  AUTH_WALLET_CONNECT_SUCCESS: "auth_wallet_connect_success",
  AUTH_WALLET_CONNECT_FAILED: "auth_wallet_connect_failed",
  AUTH_SESSION_RESTORED: "auth_session_restored",
  AUTH_SWITCH_METHOD: "auth_switch_method",

  // Garden Join
  GARDEN_JOIN_STARTED: "garden_join_started",
  GARDEN_JOIN_SUCCESS: "garden_join_success",
  GARDEN_JOIN_FAILED: "garden_join_failed",
  GARDEN_JOIN_ALREADY_MEMBER: "garden_join_already_member",
  GARDEN_AUTO_JOIN_STARTED: "garden_auto_join_started",
  GARDEN_AUTO_JOIN_SUCCESS: "garden_auto_join_success",
  GARDEN_AUTO_JOIN_FAILED: "garden_auto_join_failed",

  // Work Submission
  WORK_SUBMISSION_STARTED: "work_submission_started",
  WORK_SUBMISSION_QUEUED: "work_submission_queued",
  WORK_SUBMISSION_SUCCESS: "work_submission_success",
  WORK_SUBMISSION_FAILED: "work_submission_failed",
  WORK_SUBMISSION_OFFLINE: "work_submission_offline",

  // Work Approval
  WORK_APPROVAL_STARTED: "work_approval_started",
  WORK_APPROVAL_SUCCESS: "work_approval_success",
  WORK_APPROVAL_FAILED: "work_approval_failed",
  WORK_REJECTION_SUCCESS: "work_rejection_success",

  // Admin: Garden Management
  ADMIN_GARDEN_CREATE_STARTED: "admin_garden_create_started",
  ADMIN_GARDEN_CREATE_SUCCESS: "admin_garden_create_success",
  ADMIN_GARDEN_CREATE_FAILED: "admin_garden_create_failed",
  ADMIN_GARDEN_UPDATE_SUCCESS: "admin_garden_update_success",

  // Admin: Member Management
  ADMIN_MEMBER_ADD_STARTED: "admin_member_add_started",
  ADMIN_MEMBER_ADD_SUCCESS: "admin_member_add_success",
  ADMIN_MEMBER_ADD_FAILED: "admin_member_add_failed",
  ADMIN_MEMBER_REMOVE_STARTED: "admin_member_remove_started",
  ADMIN_MEMBER_REMOVE_SUCCESS: "admin_member_remove_success",
  ADMIN_MEMBER_REMOVE_FAILED: "admin_member_remove_failed",

  // Admin: Deployment
  ADMIN_DEPLOY_STARTED: "admin_deploy_started",
  ADMIN_DEPLOY_SUCCESS: "admin_deploy_success",
  ADMIN_DEPLOY_FAILED: "admin_deploy_failed",
  ADMIN_CONTRACT_VERIFY_STARTED: "admin_contract_verify_started",
  ADMIN_CONTRACT_VERIFY_SUCCESS: "admin_contract_verify_success",
  ADMIN_CONTRACT_VERIFY_FAILED: "admin_contract_verify_failed",

  // Admin: Action Management
  ADMIN_ACTION_CREATE_STARTED: "admin_action_create_started",
  ADMIN_ACTION_CREATE_SUCCESS: "admin_action_create_success",
  ADMIN_ACTION_CREATE_FAILED: "admin_action_create_failed",
  ADMIN_ACTION_UPDATE_SUCCESS: "admin_action_update_success",
} as const;

// ============================================================================
// AUTH TRACKING
// ============================================================================

export const trackAuthPasskeyRegisterStarted = createTracker<{ userName: string }>(
  ANALYTICS_EVENTS.AUTH_PASSKEY_REGISTER_STARTED
);

export const trackAuthPasskeyRegisterSuccess = createTracker<{
  smartAccountAddress: string;
  userName: string;
}>(ANALYTICS_EVENTS.AUTH_PASSKEY_REGISTER_SUCCESS);

export const trackAuthPasskeyRegisterFailed = createTracker<{ error: string; userName: string }>(
  ANALYTICS_EVENTS.AUTH_PASSKEY_REGISTER_FAILED
);

export const trackAuthPasskeyLoginStarted = createTracker<{ userName: string }>(
  ANALYTICS_EVENTS.AUTH_PASSKEY_LOGIN_STARTED
);

export const trackAuthPasskeyLoginSuccess = createTracker<{
  smartAccountAddress: string;
  userName: string;
}>(ANALYTICS_EVENTS.AUTH_PASSKEY_LOGIN_SUCCESS);

export const trackAuthPasskeyLoginFailed = createTracker<{ error: string; userName: string }>(
  ANALYTICS_EVENTS.AUTH_PASSKEY_LOGIN_FAILED
);

export const trackAuthWalletConnectStarted = () =>
  track(ANALYTICS_EVENTS.AUTH_WALLET_CONNECT_STARTED, {});

export const trackAuthWalletConnectSuccess = createTracker<{ walletAddress: string }>(
  ANALYTICS_EVENTS.AUTH_WALLET_CONNECT_SUCCESS
);

export const trackAuthWalletConnectFailed = createTracker<{ error: string }>(
  ANALYTICS_EVENTS.AUTH_WALLET_CONNECT_FAILED
);

export const trackAuthSessionRestored = createTracker<{
  smartAccountAddress: string;
  userName: string;
}>(ANALYTICS_EVENTS.AUTH_SESSION_RESTORED);

export const trackAuthSwitchMethod = createTracker<{
  from: "passkey" | "wallet";
  to: "passkey" | "wallet";
}>(ANALYTICS_EVENTS.AUTH_SWITCH_METHOD);

// ============================================================================
// GARDEN JOIN TRACKING
// ============================================================================

export const trackGardenJoinStarted = createTracker<{
  gardenAddress: string;
  gardenName?: string;
  authMode: AuthMode;
}>(ANALYTICS_EVENTS.GARDEN_JOIN_STARTED);

export const trackGardenJoinSuccess = createTracker<{
  gardenAddress: string;
  gardenName?: string;
  txHash: string;
  authMode: AuthMode;
}>(ANALYTICS_EVENTS.GARDEN_JOIN_SUCCESS);

export const trackGardenJoinFailed = createTracker<{
  gardenAddress: string;
  error: string;
  authMode: AuthMode;
}>(ANALYTICS_EVENTS.GARDEN_JOIN_FAILED);

export const trackGardenJoinAlreadyMember = createTracker<{ gardenAddress: string }>(
  ANALYTICS_EVENTS.GARDEN_JOIN_ALREADY_MEMBER
);

export const trackGardenAutoJoinStarted = createTracker<{
  gardenAddress: string;
  gardenName?: string;
}>(ANALYTICS_EVENTS.GARDEN_AUTO_JOIN_STARTED);

export const trackGardenAutoJoinSuccess = createTracker<{
  gardenAddress: string;
  gardenName?: string;
  txHash: string;
}>(ANALYTICS_EVENTS.GARDEN_AUTO_JOIN_SUCCESS);

export const trackGardenAutoJoinFailed = createTracker<{ gardenAddress: string; error: string }>(
  ANALYTICS_EVENTS.GARDEN_AUTO_JOIN_FAILED
);

// ============================================================================
// WORK SUBMISSION TRACKING
// ============================================================================

export const trackWorkSubmissionStarted = createTracker<{
  gardenAddress: string;
  actionUID: number;
  actionTitle?: string;
  authMode: AuthMode;
  imageCount: number;
}>(ANALYTICS_EVENTS.WORK_SUBMISSION_STARTED);

export const trackWorkSubmissionQueued = createTracker<{
  gardenAddress: string;
  actionUID: number;
  jobId: string;
  isOnline: boolean;
}>(ANALYTICS_EVENTS.WORK_SUBMISSION_QUEUED);

export const trackWorkSubmissionSuccess = createTracker<{
  gardenAddress: string;
  actionUID: number;
  txHash: string;
  authMode: AuthMode;
  wasOffline: boolean;
}>(ANALYTICS_EVENTS.WORK_SUBMISSION_SUCCESS);

export const trackWorkSubmissionFailed = createTracker<{
  gardenAddress: string;
  actionUID: number;
  error: string;
  authMode: AuthMode;
}>(ANALYTICS_EVENTS.WORK_SUBMISSION_FAILED);

export const trackWorkSubmissionOffline = createTracker<{
  gardenAddress: string;
  actionUID: number;
  jobId: string;
}>(ANALYTICS_EVENTS.WORK_SUBMISSION_OFFLINE);

// ============================================================================
// WORK APPROVAL TRACKING
// ============================================================================

export const trackWorkApprovalStarted = createTracker<{
  workUID: string;
  gardenAddress: string;
  approved: boolean;
  authMode: AuthMode;
}>(ANALYTICS_EVENTS.WORK_APPROVAL_STARTED);

export const trackWorkApprovalSuccess = createTracker<{
  workUID: string;
  gardenAddress: string;
  txHash: string;
  authMode: AuthMode;
}>(ANALYTICS_EVENTS.WORK_APPROVAL_SUCCESS);

export const trackWorkRejectionSuccess = createTracker<{
  workUID: string;
  gardenAddress: string;
  txHash: string;
  authMode: AuthMode;
}>(ANALYTICS_EVENTS.WORK_REJECTION_SUCCESS);

export const trackWorkApprovalFailed = createTracker<{
  workUID: string;
  gardenAddress: string;
  error: string;
  authMode: AuthMode;
}>(ANALYTICS_EVENTS.WORK_APPROVAL_FAILED);

// ============================================================================
// WALLET SUBMISSION TIMING
// ============================================================================

export function trackWalletSubmissionTiming(props: {
  gardenAddress: string;
  actionUID: number;
  totalTimeMs: number;
  imageCount: number;
}) {
  const timingBucket =
    props.totalTimeMs < 5000
      ? "fast"
      : props.totalTimeMs < 10000
        ? "normal"
        : props.totalTimeMs < 20000
          ? "slow"
          : "very_slow";

  track("wallet_submission_timing", {
    ...toSnakeCase(props),
    timing_bucket: timingBucket,
  });
}

// ============================================================================
// ADMIN: GARDEN MANAGEMENT
// ============================================================================

export const trackAdminGardenCreateStarted = createTracker<{
  gardenName: string;
  chainId: number;
}>(ANALYTICS_EVENTS.ADMIN_GARDEN_CREATE_STARTED);

export const trackAdminGardenCreateSuccess = createTracker<{
  gardenName: string;
  gardenAddress: string;
  chainId: number;
  txHash: string;
}>(ANALYTICS_EVENTS.ADMIN_GARDEN_CREATE_SUCCESS);

export const trackAdminGardenCreateFailed = createTracker<{
  gardenName: string;
  chainId: number;
  error: string;
}>(ANALYTICS_EVENTS.ADMIN_GARDEN_CREATE_FAILED);

// ============================================================================
// ADMIN: MEMBER MANAGEMENT
// ============================================================================

export const trackAdminMemberAddStarted = createTracker<{
  gardenAddress: string;
  memberType: MemberType;
  targetAddress: string;
}>(ANALYTICS_EVENTS.ADMIN_MEMBER_ADD_STARTED);

export const trackAdminMemberAddSuccess = createTracker<{
  gardenAddress: string;
  memberType: MemberType;
  targetAddress: string;
  txHash: string;
}>(ANALYTICS_EVENTS.ADMIN_MEMBER_ADD_SUCCESS);

export const trackAdminMemberAddFailed = createTracker<{
  gardenAddress: string;
  memberType: MemberType;
  targetAddress: string;
  error: string;
}>(ANALYTICS_EVENTS.ADMIN_MEMBER_ADD_FAILED);

export const trackAdminMemberRemoveStarted = createTracker<{
  gardenAddress: string;
  memberType: MemberType;
  targetAddress: string;
}>(ANALYTICS_EVENTS.ADMIN_MEMBER_REMOVE_STARTED);

export const trackAdminMemberRemoveSuccess = createTracker<{
  gardenAddress: string;
  memberType: MemberType;
  targetAddress: string;
  txHash: string;
}>(ANALYTICS_EVENTS.ADMIN_MEMBER_REMOVE_SUCCESS);

export const trackAdminMemberRemoveFailed = createTracker<{
  gardenAddress: string;
  memberType: MemberType;
  targetAddress: string;
  error: string;
}>(ANALYTICS_EVENTS.ADMIN_MEMBER_REMOVE_FAILED);

// ============================================================================
// ADMIN: DEPLOYMENT
// ============================================================================

export const trackAdminDeployStarted = createTracker<{ chainId: number; contractType: string }>(
  ANALYTICS_EVENTS.ADMIN_DEPLOY_STARTED
);

export const trackAdminDeploySuccess = createTracker<{
  chainId: number;
  contractType: string;
  contractAddress: string;
  txHash: string;
}>(ANALYTICS_EVENTS.ADMIN_DEPLOY_SUCCESS);

export const trackAdminDeployFailed = createTracker<{
  chainId: number;
  contractType: string;
  error: string;
}>(ANALYTICS_EVENTS.ADMIN_DEPLOY_FAILED);
