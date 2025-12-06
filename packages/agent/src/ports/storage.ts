/**
 * Storage Port - Interface for persistent data storage
 *
 * This port defines the contract for storing users, sessions, and pending work.
 * Implementations can use SQLite, PostgreSQL, or any other storage backend.
 */

import type { Platform } from "../core/contracts/message";
import type { Session } from "../core/contracts/response";

/**
 * User record stored in the database
 */
export interface User {
  /** Platform identifier (telegram, discord, whatsapp) */
  platform: Platform;
  /** Platform-specific user ID */
  platformId: string;
  /** Encrypted private key for custodial wallet */
  privateKey: string;
  /** Wallet address */
  address: string;
  /** Currently joined garden address */
  currentGarden?: string;
  /** User role in current garden */
  role?: "gardener" | "operator";
  /** Account creation timestamp */
  createdAt: number;
}

/**
 * Input for creating a new user
 */
export interface CreateUserInput {
  platform: Platform;
  platformId: string;
  privateKey: string;
  address: string;
  currentGarden?: string;
  role?: "gardener" | "operator";
}

/**
 * Pending work submission awaiting approval
 */
export interface PendingWork {
  /** Unique work ID */
  id: string;
  /** Action UID from the action registry */
  actionUID: number;
  /** Gardener's wallet address */
  gardenerAddress: string;
  /** Gardener's platform identifier */
  gardenerPlatform: Platform;
  /** Gardener's platform-specific ID */
  gardenerPlatformId: string;
  /** Garden contract address */
  gardenAddress: string;
  /** Work submission data */
  data: WorkDraftData;
  /** Submission timestamp */
  createdAt: number;
}

/**
 * Structured work draft data
 */
export interface WorkDraftData {
  actionUID: number;
  title: string;
  plantSelection: string[];
  plantCount: number;
  feedback: string;
  media: string[];
}

/**
 * Storage port interface
 */
export interface StoragePort {
  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================

  /**
   * Get a user by platform and platform ID.
   * Returns undefined if user doesn't exist.
   */
  getUser(platform: Platform, platformId: string): Promise<User | undefined>;

  /**
   * Create a new user.
   * The private key should be encrypted before storage.
   */
  createUser(input: CreateUserInput): Promise<User>;

  /**
   * Update an existing user.
   * Only provided fields will be updated.
   */
  updateUser(
    platform: Platform,
    platformId: string,
    update: Partial<Pick<User, "currentGarden" | "role">>
  ): Promise<void>;

  /**
   * Get an operator for a specific garden.
   * Returns undefined if no operator is registered.
   */
  getOperatorForGarden(gardenAddress: string): Promise<User | undefined>;

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Get the current session for a user.
   * Returns undefined if no active session.
   */
  getSession(platform: Platform, platformId: string): Promise<Session | undefined>;

  /**
   * Set or update a session.
   */
  setSession(session: Session): Promise<void>;

  /**
   * Clear a user's session.
   */
  clearSession(platform: Platform, platformId: string): Promise<void>;

  // ============================================================================
  // PENDING WORK
  // ============================================================================

  /**
   * Add a new pending work submission.
   */
  addPendingWork(work: Omit<PendingWork, "createdAt">): Promise<void>;

  /**
   * Get a pending work by ID.
   * Returns undefined if not found.
   */
  getPendingWork(id: string): Promise<PendingWork | undefined>;

  /**
   * Get all pending works for a garden.
   */
  getPendingWorksForGarden(gardenAddress: string): Promise<PendingWork[]>;

  /**
   * Remove a pending work after processing.
   */
  removePendingWork(id: string): Promise<void>;

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  /**
   * Close the storage connection.
   * Should be called during graceful shutdown.
   */
  close(): Promise<void>;
}

