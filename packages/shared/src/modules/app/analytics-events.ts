/**
 * Analytics Events Module
 *
 * Centralized definitions for all product funnel events.
 * Provides typed tracking functions for consistent analytics.
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
// EVENT NAMES
// ============================================================================

export const ANALYTICS_EVENTS = {
  // ─────────────────────────────────────────────────────────────────────────
  // ONBOARDING / AUTH
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // GARDEN JOIN
  // ─────────────────────────────────────────────────────────────────────────
  GARDEN_JOIN_STARTED: "garden_join_started",
  GARDEN_JOIN_SUCCESS: "garden_join_success",
  GARDEN_JOIN_FAILED: "garden_join_failed",
  GARDEN_JOIN_ALREADY_MEMBER: "garden_join_already_member",
  GARDEN_AUTO_JOIN_STARTED: "garden_auto_join_started",
  GARDEN_AUTO_JOIN_SUCCESS: "garden_auto_join_success",
  GARDEN_AUTO_JOIN_FAILED: "garden_auto_join_failed",

  // ─────────────────────────────────────────────────────────────────────────
  // WORK SUBMISSION
  // ─────────────────────────────────────────────────────────────────────────
  WORK_SUBMISSION_STARTED: "work_submission_started",
  WORK_SUBMISSION_QUEUED: "work_submission_queued",
  WORK_SUBMISSION_SUCCESS: "work_submission_success",
  WORK_SUBMISSION_FAILED: "work_submission_failed",
  WORK_SUBMISSION_OFFLINE: "work_submission_offline",

  // ─────────────────────────────────────────────────────────────────────────
  // WORK APPROVAL
  // ─────────────────────────────────────────────────────────────────────────
  WORK_APPROVAL_STARTED: "work_approval_started",
  WORK_APPROVAL_SUCCESS: "work_approval_success",
  WORK_APPROVAL_FAILED: "work_approval_failed",
  WORK_REJECTION_SUCCESS: "work_rejection_success",

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: GARDEN MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────
  ADMIN_GARDEN_CREATE_STARTED: "admin_garden_create_started",
  ADMIN_GARDEN_CREATE_SUCCESS: "admin_garden_create_success",
  ADMIN_GARDEN_CREATE_FAILED: "admin_garden_create_failed",
  ADMIN_GARDEN_UPDATE_SUCCESS: "admin_garden_update_success",

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: MEMBER MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────
  ADMIN_MEMBER_ADD_STARTED: "admin_member_add_started",
  ADMIN_MEMBER_ADD_SUCCESS: "admin_member_add_success",
  ADMIN_MEMBER_ADD_FAILED: "admin_member_add_failed",
  ADMIN_MEMBER_REMOVE_STARTED: "admin_member_remove_started",
  ADMIN_MEMBER_REMOVE_SUCCESS: "admin_member_remove_success",
  ADMIN_MEMBER_REMOVE_FAILED: "admin_member_remove_failed",

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: DEPLOYMENT
  // ─────────────────────────────────────────────────────────────────────────
  ADMIN_DEPLOY_STARTED: "admin_deploy_started",
  ADMIN_DEPLOY_SUCCESS: "admin_deploy_success",
  ADMIN_DEPLOY_FAILED: "admin_deploy_failed",
  ADMIN_CONTRACT_VERIFY_STARTED: "admin_contract_verify_started",
  ADMIN_CONTRACT_VERIFY_SUCCESS: "admin_contract_verify_success",
  ADMIN_CONTRACT_VERIFY_FAILED: "admin_contract_verify_failed",

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: ACTION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────
  ADMIN_ACTION_CREATE_STARTED: "admin_action_create_started",
  ADMIN_ACTION_CREATE_SUCCESS: "admin_action_create_success",
  ADMIN_ACTION_CREATE_FAILED: "admin_action_create_failed",
  ADMIN_ACTION_UPDATE_SUCCESS: "admin_action_update_success",
} as const;

// ============================================================================
// TYPED TRACKING FUNCTIONS
// ============================================================================

// ─────────────────────────────────────────────────────────────────────────
// ONBOARDING / AUTH
// ─────────────────────────────────────────────────────────────────────────

export function trackAuthPasskeyRegisterStarted(props: { userName: string }) {
  track(ANALYTICS_EVENTS.AUTH_PASSKEY_REGISTER_STARTED, {
    user_name: props.userName,
  });
}

export function trackAuthPasskeyRegisterSuccess(props: {
  smartAccountAddress: string;
  userName: string;
}) {
  track(ANALYTICS_EVENTS.AUTH_PASSKEY_REGISTER_SUCCESS, {
    smart_account_address: props.smartAccountAddress,
    user_name: props.userName,
  });
}

export function trackAuthPasskeyRegisterFailed(props: { error: string; userName: string }) {
  track(ANALYTICS_EVENTS.AUTH_PASSKEY_REGISTER_FAILED, {
    error: props.error,
    user_name: props.userName,
  });
}

export function trackAuthPasskeyLoginStarted(props: { userName: string }) {
  track(ANALYTICS_EVENTS.AUTH_PASSKEY_LOGIN_STARTED, {
    user_name: props.userName,
  });
}

export function trackAuthPasskeyLoginSuccess(props: {
  smartAccountAddress: string;
  userName: string;
}) {
  track(ANALYTICS_EVENTS.AUTH_PASSKEY_LOGIN_SUCCESS, {
    smart_account_address: props.smartAccountAddress,
    user_name: props.userName,
  });
}

export function trackAuthPasskeyLoginFailed(props: { error: string; userName: string }) {
  track(ANALYTICS_EVENTS.AUTH_PASSKEY_LOGIN_FAILED, {
    error: props.error,
    user_name: props.userName,
  });
}

export function trackAuthWalletConnectStarted() {
  track(ANALYTICS_EVENTS.AUTH_WALLET_CONNECT_STARTED, {});
}

export function trackAuthWalletConnectSuccess(props: { walletAddress: string }) {
  track(ANALYTICS_EVENTS.AUTH_WALLET_CONNECT_SUCCESS, {
    wallet_address: props.walletAddress,
  });
}

export function trackAuthWalletConnectFailed(props: { error: string }) {
  track(ANALYTICS_EVENTS.AUTH_WALLET_CONNECT_FAILED, {
    error: props.error,
  });
}

export function trackAuthSessionRestored(props: { smartAccountAddress: string; userName: string }) {
  track(ANALYTICS_EVENTS.AUTH_SESSION_RESTORED, {
    smart_account_address: props.smartAccountAddress,
    user_name: props.userName,
  });
}

export function trackAuthSwitchMethod(props: {
  from: "passkey" | "wallet";
  to: "passkey" | "wallet";
}) {
  track(ANALYTICS_EVENTS.AUTH_SWITCH_METHOD, {
    from_method: props.from,
    to_method: props.to,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// GARDEN JOIN
// ─────────────────────────────────────────────────────────────────────────

export function trackGardenJoinStarted(props: {
  gardenAddress: string;
  gardenName?: string;
  authMode: "passkey" | "wallet" | null;
}) {
  track(ANALYTICS_EVENTS.GARDEN_JOIN_STARTED, {
    garden_address: props.gardenAddress,
    garden_name: props.gardenName,
    auth_mode: props.authMode,
  });
}

export function trackGardenJoinSuccess(props: {
  gardenAddress: string;
  gardenName?: string;
  txHash: string;
  authMode: "passkey" | "wallet" | null;
}) {
  track(ANALYTICS_EVENTS.GARDEN_JOIN_SUCCESS, {
    garden_address: props.gardenAddress,
    garden_name: props.gardenName,
    tx_hash: props.txHash,
    auth_mode: props.authMode,
  });
}

export function trackGardenJoinFailed(props: {
  gardenAddress: string;
  error: string;
  authMode: "passkey" | "wallet" | null;
}) {
  track(ANALYTICS_EVENTS.GARDEN_JOIN_FAILED, {
    garden_address: props.gardenAddress,
    error: props.error,
    auth_mode: props.authMode,
  });
}

export function trackGardenJoinAlreadyMember(props: { gardenAddress: string }) {
  track(ANALYTICS_EVENTS.GARDEN_JOIN_ALREADY_MEMBER, {
    garden_address: props.gardenAddress,
  });
}

export function trackGardenAutoJoinStarted(props: { gardenAddress: string; gardenName?: string }) {
  track(ANALYTICS_EVENTS.GARDEN_AUTO_JOIN_STARTED, {
    garden_address: props.gardenAddress,
    garden_name: props.gardenName,
  });
}

export function trackGardenAutoJoinSuccess(props: {
  gardenAddress: string;
  gardenName?: string;
  txHash: string;
}) {
  track(ANALYTICS_EVENTS.GARDEN_AUTO_JOIN_SUCCESS, {
    garden_address: props.gardenAddress,
    garden_name: props.gardenName,
    tx_hash: props.txHash,
  });
}

export function trackGardenAutoJoinFailed(props: { gardenAddress: string; error: string }) {
  track(ANALYTICS_EVENTS.GARDEN_AUTO_JOIN_FAILED, {
    garden_address: props.gardenAddress,
    error: props.error,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// WORK SUBMISSION
// ─────────────────────────────────────────────────────────────────────────

export function trackWorkSubmissionStarted(props: {
  gardenAddress: string;
  actionUID: number;
  actionTitle?: string;
  authMode: "passkey" | "wallet" | null;
  imageCount: number;
}) {
  track(ANALYTICS_EVENTS.WORK_SUBMISSION_STARTED, {
    garden_address: props.gardenAddress,
    action_uid: props.actionUID,
    action_title: props.actionTitle,
    auth_mode: props.authMode,
    image_count: props.imageCount,
  });
}

export function trackWorkSubmissionQueued(props: {
  gardenAddress: string;
  actionUID: number;
  jobId: string;
  isOnline: boolean;
}) {
  track(ANALYTICS_EVENTS.WORK_SUBMISSION_QUEUED, {
    garden_address: props.gardenAddress,
    action_uid: props.actionUID,
    job_id: props.jobId,
    is_online: props.isOnline,
  });
}

export function trackWorkSubmissionSuccess(props: {
  gardenAddress: string;
  actionUID: number;
  txHash: string;
  authMode: "passkey" | "wallet" | null;
  wasOffline: boolean;
}) {
  track(ANALYTICS_EVENTS.WORK_SUBMISSION_SUCCESS, {
    garden_address: props.gardenAddress,
    action_uid: props.actionUID,
    tx_hash: props.txHash,
    auth_mode: props.authMode,
    was_offline: props.wasOffline,
  });
}

export function trackWorkSubmissionFailed(props: {
  gardenAddress: string;
  actionUID: number;
  error: string;
  authMode: "passkey" | "wallet" | null;
}) {
  track(ANALYTICS_EVENTS.WORK_SUBMISSION_FAILED, {
    garden_address: props.gardenAddress,
    action_uid: props.actionUID,
    error: props.error,
    auth_mode: props.authMode,
  });
}

export function trackWorkSubmissionOffline(props: {
  gardenAddress: string;
  actionUID: number;
  jobId: string;
}) {
  track(ANALYTICS_EVENTS.WORK_SUBMISSION_OFFLINE, {
    garden_address: props.gardenAddress,
    action_uid: props.actionUID,
    job_id: props.jobId,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// WORK APPROVAL
// ─────────────────────────────────────────────────────────────────────────

export function trackWorkApprovalStarted(props: {
  workUID: string;
  gardenAddress: string;
  approved: boolean;
  authMode: "passkey" | "wallet" | null;
}) {
  track(ANALYTICS_EVENTS.WORK_APPROVAL_STARTED, {
    work_uid: props.workUID,
    garden_address: props.gardenAddress,
    approved: props.approved,
    auth_mode: props.authMode,
  });
}

export function trackWorkApprovalSuccess(props: {
  workUID: string;
  gardenAddress: string;
  txHash: string;
  authMode: "passkey" | "wallet" | null;
}) {
  track(ANALYTICS_EVENTS.WORK_APPROVAL_SUCCESS, {
    work_uid: props.workUID,
    garden_address: props.gardenAddress,
    tx_hash: props.txHash,
    auth_mode: props.authMode,
  });
}

export function trackWorkRejectionSuccess(props: {
  workUID: string;
  gardenAddress: string;
  txHash: string;
  authMode: "passkey" | "wallet" | null;
}) {
  track(ANALYTICS_EVENTS.WORK_REJECTION_SUCCESS, {
    work_uid: props.workUID,
    garden_address: props.gardenAddress,
    tx_hash: props.txHash,
    auth_mode: props.authMode,
  });
}

export function trackWorkApprovalFailed(props: {
  workUID: string;
  gardenAddress: string;
  error: string;
  authMode: "passkey" | "wallet" | null;
}) {
  track(ANALYTICS_EVENTS.WORK_APPROVAL_FAILED, {
    work_uid: props.workUID,
    garden_address: props.gardenAddress,
    error: props.error,
    auth_mode: props.authMode,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// ADMIN: GARDEN MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────

export function trackAdminGardenCreateStarted(props: { gardenName: string; chainId: number }) {
  track(ANALYTICS_EVENTS.ADMIN_GARDEN_CREATE_STARTED, {
    garden_name: props.gardenName,
    chain_id: props.chainId,
  });
}

export function trackAdminGardenCreateSuccess(props: {
  gardenName: string;
  gardenAddress: string;
  chainId: number;
  txHash: string;
}) {
  track(ANALYTICS_EVENTS.ADMIN_GARDEN_CREATE_SUCCESS, {
    garden_name: props.gardenName,
    garden_address: props.gardenAddress,
    chain_id: props.chainId,
    tx_hash: props.txHash,
  });
}

export function trackAdminGardenCreateFailed(props: {
  gardenName: string;
  chainId: number;
  error: string;
}) {
  track(ANALYTICS_EVENTS.ADMIN_GARDEN_CREATE_FAILED, {
    garden_name: props.gardenName,
    chain_id: props.chainId,
    error: props.error,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// ADMIN: MEMBER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────

export function trackAdminMemberAddStarted(props: {
  gardenAddress: string;
  memberType: "gardener" | "operator";
  targetAddress: string;
}) {
  track(ANALYTICS_EVENTS.ADMIN_MEMBER_ADD_STARTED, {
    garden_address: props.gardenAddress,
    member_type: props.memberType,
    target_address: props.targetAddress,
  });
}

export function trackAdminMemberAddSuccess(props: {
  gardenAddress: string;
  memberType: "gardener" | "operator";
  targetAddress: string;
  txHash: string;
}) {
  track(ANALYTICS_EVENTS.ADMIN_MEMBER_ADD_SUCCESS, {
    garden_address: props.gardenAddress,
    member_type: props.memberType,
    target_address: props.targetAddress,
    tx_hash: props.txHash,
  });
}

export function trackAdminMemberAddFailed(props: {
  gardenAddress: string;
  memberType: "gardener" | "operator";
  targetAddress: string;
  error: string;
}) {
  track(ANALYTICS_EVENTS.ADMIN_MEMBER_ADD_FAILED, {
    garden_address: props.gardenAddress,
    member_type: props.memberType,
    target_address: props.targetAddress,
    error: props.error,
  });
}

export function trackAdminMemberRemoveStarted(props: {
  gardenAddress: string;
  memberType: "gardener" | "operator";
  targetAddress: string;
}) {
  track(ANALYTICS_EVENTS.ADMIN_MEMBER_REMOVE_STARTED, {
    garden_address: props.gardenAddress,
    member_type: props.memberType,
    target_address: props.targetAddress,
  });
}

export function trackAdminMemberRemoveSuccess(props: {
  gardenAddress: string;
  memberType: "gardener" | "operator";
  targetAddress: string;
  txHash: string;
}) {
  track(ANALYTICS_EVENTS.ADMIN_MEMBER_REMOVE_SUCCESS, {
    garden_address: props.gardenAddress,
    member_type: props.memberType,
    target_address: props.targetAddress,
    tx_hash: props.txHash,
  });
}

export function trackAdminMemberRemoveFailed(props: {
  gardenAddress: string;
  memberType: "gardener" | "operator";
  targetAddress: string;
  error: string;
}) {
  track(ANALYTICS_EVENTS.ADMIN_MEMBER_REMOVE_FAILED, {
    garden_address: props.gardenAddress,
    member_type: props.memberType,
    target_address: props.targetAddress,
    error: props.error,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// ADMIN: DEPLOYMENT
// ─────────────────────────────────────────────────────────────────────────

export function trackAdminDeployStarted(props: { chainId: number; contractType: string }) {
  track(ANALYTICS_EVENTS.ADMIN_DEPLOY_STARTED, {
    chain_id: props.chainId,
    contract_type: props.contractType,
  });
}

export function trackAdminDeploySuccess(props: {
  chainId: number;
  contractType: string;
  contractAddress: string;
  txHash: string;
}) {
  track(ANALYTICS_EVENTS.ADMIN_DEPLOY_SUCCESS, {
    chain_id: props.chainId,
    contract_type: props.contractType,
    contract_address: props.contractAddress,
    tx_hash: props.txHash,
  });
}

export function trackAdminDeployFailed(props: {
  chainId: number;
  contractType: string;
  error: string;
}) {
  track(ANALYTICS_EVENTS.ADMIN_DEPLOY_FAILED, {
    chain_id: props.chainId,
    contract_type: props.contractType,
    error: props.error,
  });
}
