/**
 * @fileoverview Conflict Resolution System for Green Goods Application
 *
 * This module provides sophisticated conflict resolution mechanisms for handling
 * data conflicts that occur during offline synchronization. Key features include:
 *
 * - Multi-type conflict detection (submission, schema, garden, data conflicts)
 * - Severity assessment and automatic resolution capabilities
 * - Flexible merge strategies for different conflict types
 * - Schema validation and version compatibility checking
 * - Garden membership and access control validation
 * - Comprehensive conflict analytics and reporting
 *
 * The ConflictResolver ensures data integrity during sync operations by
 * intelligently detecting and resolving conflicts between local offline
 * data and remote blockchain state.
 *
 * @author Green Goods Team
 * @version 1.0.0
 */

/**
 * Defines the type and characteristics of a conflict
 */
export interface ConflictType {
  /** The category of conflict detected */
  type: "already_submitted" | "schema_mismatch" | "garden_mismatch" | "data_conflict";
  /** The severity level of the conflict */
  severity: "low" | "medium" | "high";
  /** Whether this conflict can be resolved automatically */
  autoResolvable: boolean;
}

/**
 * Represents a complete conflict situation for a work item
 */
export interface WorkConflict {
  /** Unique identifier of the work item with conflicts */
  workId: string;
  /** Array of conflicts detected for this work item */
  conflicts: ConflictType[];
  /** Local data from offline storage */
  localData: any;
  /** Remote data from blockchain/API (if available) */
  remoteData?: any;
  /** The resolution strategy chosen for this conflict */
  resolution?: "merge" | "keep_local" | "keep_remote" | "manual";
  /** The resolved data after applying resolution strategy */
  resolutionData?: any;
}

/**
 * Schema information for validation and version checking
 */
export interface SchemaInfo {
  /** Unique identifier for the schema */
  uid: string;
  /** The schema definition string */
  schema: string;
  /** Version number of the schema */
  version?: string;
  /** Whether this schema is required for the operation */
  required?: boolean;
}

/**
 * Configuration options for conflict resolution behavior
 */
export interface ConflictResolutionConfig {
  /** Base URL for API endpoints */
  apiBaseUrl: string;
  /** Time window for conflict detection in milliseconds */
  timeWindow: number;
  /** Whether to attempt automatic resolution when possible */
  autoResolve: boolean;
}

/**
 * Manages detection and resolution of data conflicts during synchronization.
 *
 * This class provides comprehensive conflict management for the Green Goods
 * offline-first architecture. It detects various types of conflicts that can
 * occur when syncing offline work to the blockchain and provides intelligent
 * resolution strategies.
 *
 * Conflict Types Handled:
 * - **Already Submitted**: Work already exists on blockchain
 * - **Schema Mismatch**: Schema version or structure conflicts
 * - **Garden Mismatch**: Garden no longer exists or user lacks access
 * - **Data Conflict**: Content conflicts between local and remote data
 *
 * Resolution Strategies:
 * - **Auto-resolution**: For low-risk conflicts with clear solutions
 * - **Merge**: Intelligently combine local and remote data
 * - **Manual**: Require user intervention for complex conflicts
 *
 * @example
 * ```typescript
 * const conflictResolver = new ConflictResolver({
 *   apiBaseUrl: '/api',
 *   timeWindow: 24 * 60 * 60 * 1000, // 24 hours
 *   autoResolve: true
 * });
 *
 * // Detect conflicts for pending work items
 * const conflicts = await conflictResolver.detectConflicts(workItems);
 *
 * // Resolve conflicts automatically where possible
 * for (const conflict of conflicts) {
 *   if (conflict.conflicts.some(c => c.autoResolvable)) {
 *     const resolved = await conflictResolver.resolveConflict(
 *       conflict.workId,
 *       'merge'
 *     );
 *     console.log('Conflict resolved:', resolved);
 *   }
 * }
 * ```
 */
export class ConflictResolver {
  private config: ConflictResolutionConfig;
  private detectedConflicts: Map<string, WorkConflict> = new Map();

  /**
   * Creates a new ConflictResolver instance with specified configuration
   *
   * @param config - Partial configuration object (uses defaults for missing values)
   */
  constructor(config: Partial<ConflictResolutionConfig> = {}) {
    this.config = {
      apiBaseUrl: "/api",
      timeWindow: 24 * 60 * 60 * 1000, // 24 hours
      autoResolve: true,
      ...config,
    };
  }

  /**
   * Detects conflicts for an array of work items
   *
   * This method performs comprehensive conflict analysis by checking each
   * work item against multiple potential conflict sources. It builds a
   * complete picture of all conflicts that need resolution before sync.
   *
   * @param workItems - Array of work items to analyze for conflicts
   * @returns Promise resolving to array of detected conflicts
   */
  async detectConflicts(workItems: any[]): Promise<WorkConflict[]> {
    const conflicts: WorkConflict[] = [];

    for (const work of workItems) {
      const workConflicts: ConflictType[] = [];

      try {
        // Check if work was already submitted
        const existingWork = await this.checkExistingWork(work);
        if (existingWork) {
          workConflicts.push({
            type: "already_submitted",
            severity: "high",
            autoResolvable: true,
          });
        }

        // Check schema conflicts
        const schemaConflicts = await this.checkSchemaConflicts(work);
        workConflicts.push(...schemaConflicts);

        // Check garden conflicts
        const gardenConflicts = await this.checkGardenConflicts(work);
        workConflicts.push(...gardenConflicts);

        if (workConflicts.length > 0) {
          conflicts.push({
            workId: work.id,
            conflicts: workConflicts,
            localData: work,
            remoteData: existingWork,
          });
        }
      } catch (error) {
        console.error(`Error detecting conflicts for work ${work.id}:`, error);
        // Continue processing other items
      }
    }

    // Store detected conflicts
    conflicts.forEach((conflict) => {
      this.detectedConflicts.set(conflict.workId, conflict);
    });

    return conflicts;
  }

  /**
   * Resolves a specific conflict using the chosen strategy
   *
   * This method applies the specified resolution strategy to resolve a conflict.
   * It supports multiple resolution approaches and updates the conflict record
   * with the resolution details.
   *
   * @param workId - Unique identifier of the work item to resolve
   * @param resolution - The resolution strategy to apply
   * @param resolutionData - Additional data needed for manual resolution
   * @returns Promise resolving to the resolved data
   * @throws Error if conflict not found or resolution fails
   */
  async resolveConflict(
    workId: string,
    resolution: "merge" | "keep_local" | "keep_remote" | "manual",
    resolutionData?: any
  ): Promise<any> {
    const conflict = this.detectedConflicts.get(workId);
    if (!conflict) {
      throw new Error(`No conflict found for work ID: ${workId}`);
    }

    let resolvedData: any;

    switch (resolution) {
      case "merge":
        resolvedData = await this.mergeConflict(conflict, resolutionData);
        break;
      case "keep_local":
        resolvedData = conflict.localData;
        break;
      case "keep_remote":
        if (!conflict.remoteData) {
          throw new Error("No remote data available for conflict resolution");
        }
        resolvedData = conflict.remoteData;
        break;
      case "manual":
        if (!resolutionData) {
          throw new Error("Manual resolution requires resolution data");
        }
        resolvedData = resolutionData;
        break;
      default:
        throw new Error(`Unknown resolution type: ${resolution}`);
    }

    // Update conflict record
    conflict.resolution = resolution;
    conflict.resolutionData = resolvedData;

    return resolvedData;
  }

  /**
   * Checks if work item already exists on the blockchain or remote system
   *
   * This method queries the API to determine if the work has already been
   * submitted, helping prevent duplicate submissions during sync operations.
   *
   * @param work - The work item to check for existing submission
   * @returns Promise resolving to existing work data or null if not found
   */
  async checkExistingWork(work: any): Promise<any | null> {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/work/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentHash: work.contentHash,
          gardenId: work.gardenId,
          timeWindow: this.config.timeWindow,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // No existing work found
        }
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      return result.exists ? result.work : null;
    } catch (error) {
      console.error("Error checking existing work:", error);
      return null; // Assume no conflict on error
    }
  }

  /**
   * Checks for schema-related conflicts
   *
   * This method validates that the work item's schema is compatible with
   * the current system state, checking for version mismatches or structural
   * changes that could cause sync failures.
   *
   * @param work - The work item to check for schema conflicts
   * @returns Promise resolving to array of schema-related conflicts
   */
  async checkSchemaConflicts(work: any): Promise<ConflictType[]> {
    const conflicts: ConflictType[] = [];

    try {
      const currentSchema = await this.getCurrentSchema(work.schemaId);

      if (!currentSchema) {
        conflicts.push({
          type: "schema_mismatch",
          severity: "high",
          autoResolvable: false,
        });
        return conflicts;
      }

      // Check if schema version has changed
      if (
        work.schemaVersion &&
        currentSchema.version &&
        work.schemaVersion !== currentSchema.version
      ) {
        conflicts.push({
          type: "schema_mismatch",
          severity: "medium",
          autoResolvable: true,
        });
      }

      // Check if schema structure has changed
      if (work.schema && work.schema !== currentSchema.schema) {
        conflicts.push({
          type: "schema_mismatch",
          severity: "high",
          autoResolvable: false,
        });
      }
    } catch (error) {
      console.error("Error checking schema conflicts:", error);
      // Don't add conflicts on API errors to avoid blocking sync
    }

    return conflicts;
  }

  /**
   * Checks for garden-related conflicts
   *
   * This method validates that the garden referenced in the work item
   * still exists, is active, and that the user still has access to it.
   *
   * @param work - The work item to check for garden conflicts
   * @returns Promise resolving to array of garden-related conflicts
   */
  async checkGardenConflicts(work: any): Promise<ConflictType[]> {
    const conflicts: ConflictType[] = [];

    try {
      const response = await fetch(`${this.config.apiBaseUrl}/gardens/${work.gardenId}`);

      if (!response.ok) {
        if (response.status === 404) {
          conflicts.push({
            type: "garden_mismatch",
            severity: "high",
            autoResolvable: false,
          });
        }
        return conflicts;
      }

      const garden = await response.json();

      // Check if garden is still active
      if (garden.status !== "active") {
        conflicts.push({
          type: "garden_mismatch",
          severity: "medium",
          autoResolvable: false,
        });
      }

      // Check if user still has access to garden
      if (work.userId && garden.members && !garden.members.includes(work.userId)) {
        conflicts.push({
          type: "garden_mismatch",
          severity: "high",
          autoResolvable: false,
        });
      }
    } catch (error) {
      console.error("Error checking garden conflicts:", error);
      // Don't add conflicts on API errors
    }

    return conflicts;
  }

  /**
   * Merges conflicting data using intelligent merge strategies
   *
   * This method implements smart merging logic that preserves local content
   * while updating system fields from remote data. The merge strategy can
   * be customized based on the specific merge requirements.
   *
   * @param conflict - The work conflict to merge
   * @param mergeStrategy - Optional custom merge strategy data
   * @returns Promise resolving to merged data
   */
  async mergeConflict(conflict: WorkConflict, mergeStrategy?: any): Promise<any> {
    const { localData, remoteData } = conflict;

    if (!remoteData) {
      return localData; // Nothing to merge with
    }

    // Default merge strategy: prefer local data but update timestamps and status
    const merged = {
      ...localData,
      ...mergeStrategy,
      // Always keep local content and metadata
      title: localData.title,
      description: localData.description,
      images: localData.images,
      // Update system fields from remote if they exist
      updatedAt: remoteData.updatedAt || localData.updatedAt,
      version: remoteData.version ? remoteData.version + 1 : localData.version || 1,
    };

    return merged;
  }

  /**
   * Retrieves current schema information from the API
   *
   * @param schemaId - The unique identifier of the schema to fetch
   * @returns Promise resolving to schema information or null if not found
   */
  async getCurrentSchema(schemaId: string): Promise<SchemaInfo | null> {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/schemas/${schemaId}`);

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching current schema:", error);
      return null;
    }
  }

  /**
   * Gets all currently detected conflicts
   *
   * @returns Array of all work conflicts currently tracked
   */
  getConflicts(): WorkConflict[] {
    return Array.from(this.detectedConflicts.values());
  }

  /**
   * Gets a specific conflict by work ID
   *
   * @param workId - The work ID to get conflict for
   * @returns The work conflict or undefined if not found
   */
  getConflictById(workId: string): WorkConflict | undefined {
    return this.detectedConflicts.get(workId);
  }

  /**
   * Removes a specific conflict from tracking
   *
   * This method should be called after successfully resolving and syncing
   * a conflict to clean up the conflict tracking state.
   *
   * @param workId - The work ID to clear from conflict tracking
   */
  clearConflict(workId: string): void {
    this.detectedConflicts.delete(workId);
  }

  /**
   * Clears all tracked conflicts
   *
   * This method removes all conflicts from the tracking system. Use with
   * caution as it will lose all conflict resolution state.
   */
  clearAllConflicts(): void {
    this.detectedConflicts.clear();
  }

  /**
   * Generates comprehensive statistics about detected conflicts
   *
   * This method provides detailed analytics about the current conflict
   * situation, including breakdown by type, severity, and resolution status.
   *
   * @returns Object containing detailed conflict statistics
   */
  getConflictStats(): {
    total: number;
    autoResolvable: number;
    manualResolution: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    const conflicts = this.getConflicts();
    const stats = {
      total: conflicts.length,
      autoResolvable: 0,
      manualResolution: 0,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
    };

    conflicts.forEach((conflict) => {
      const hasAutoResolvable = conflict.conflicts.some((c) => c.autoResolvable);
      if (hasAutoResolvable) {
        stats.autoResolvable++;
      } else {
        stats.manualResolution++;
      }

      conflict.conflicts.forEach((c) => {
        stats.byType[c.type] = (stats.byType[c.type] || 0) + 1;
        stats.bySeverity[c.severity] = (stats.bySeverity[c.severity] || 0) + 1;
      });
    });

    return stats;
  }
}

/**
 * Default ConflictResolver instance for use throughout the application
 *
 * This singleton instance provides consistent conflict resolution behavior
 * across the entire application and maintains centralized conflict state.
 */
export const defaultConflictResolver = new ConflictResolver();
