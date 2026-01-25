import type { LevelData } from '../../levels/LevelSchema';
import type { UserProfile } from '../LevelService';

/**
 * Unified API Interface
 * All backend operations should go through this interface.
 * Implementations can be swapped (e.g., MockApiClient, RestApiClient).
 */
export interface IApiClient {
  // ==================== Levels ====================

  /**
   * Get all public levels from the server.
   */
  getLevels(): Promise<LevelData[]>;

  /**
   * Get a specific level by ID.
   */
  getLevel(levelId: string): Promise<LevelData | null>;

  /**
   * Publish a level (upload and make it public).
   * The level data is sent along with the publish request.
   */
  publishLevel(level: LevelData): Promise<void>;

  /**
   * Unpublish / take down a level.
   */
  unpublishLevel(levelId: string): Promise<void>;

  /**
   * Delete a level permanently.
   */
  deleteLevel(levelId: string): Promise<void>;

  /**
   * Toggle like status for a level.
   * Returns the new like status (true = liked).
   */
  toggleLike(levelId: string): Promise<boolean>;

  /**
   * Get like count for a level.
   */
  getLikeCount(levelId: string): Promise<number>;

  // ==================== Users ====================

  /**
   * Get the current user's profile.
   */
  getCurrentUser(): Promise<UserProfile>;

  /**
   * Update the current user's profile.
   */
  updateCurrentUser(data: Partial<UserProfile>): Promise<UserProfile>;

  /**
   * Login with Google Credential.
   */
  loginWithGoogle(token: string): Promise<{ token: string; user: UserProfile }>;

  /**
   * Logout the current user.
   */
  logout(): Promise<void>;

  /**
   * Get another user's public profile.
   */
  getUser(userId: string): Promise<UserProfile | null>;

  /**
   * Get levels created by a specific user.
   */
  getUserLevels(userId: string): Promise<LevelData[]>;

  // ==================== Stats ====================

  /**
   * Record a level attempt.
   */
  recordAttempt(levelId: string): Promise<void>;

  /**
   * Record a level clear.
   */
  recordClear(levelId: string): Promise<void>;
}
