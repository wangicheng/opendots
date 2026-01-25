import type { IApiClient } from './IApiClient';
import type { LevelData } from '../../levels/LevelSchema';
import type { UserProfile } from '../LevelService';
import { CURRENT_USER_ID } from '../LevelService';
import { getDefaultLevels, OFFICIAL_USER_ID, OFFICIAL_USER_NAME } from './DefaultLevels';

const STORAGE_KEY_LEVELS = 'opendots_mock_levels';
const STORAGE_KEY_USERS = 'opendots_mock_users';
const STORAGE_KEY_LIKES = 'opendots_mock_user_likes';
const STORAGE_KEY_STATS = 'opendots_mock_stats';
const STORAGE_KEY_SEEDED = 'opendots_mock_seeded';

/**
 * Mock API Client Implementation
 * Uses localStorage to simulate a backend for development/testing.
 */
export class MockApiClient implements IApiClient {
  private levels: Map<string, LevelData> = new Map();
  private users: Map<string, UserProfile> = new Map();
  private userLikes: Set<string> = new Set(); // levelIds liked by current user
  private stats: Map<string, { attempts: number; clears: number }> = new Map();

  constructor() {
    this.loadFromStorage();
    this.seedDefaultData();
  }

  private loadFromStorage(): void {
    try {
      const levelsData = localStorage.getItem(STORAGE_KEY_LEVELS);
      if (levelsData) {
        const arr: LevelData[] = JSON.parse(levelsData);
        arr.forEach(l => this.levels.set(l.id, l));
      }

      const usersData = localStorage.getItem(STORAGE_KEY_USERS);
      if (usersData) {
        const arr: UserProfile[] = JSON.parse(usersData);
        arr.forEach(u => this.users.set(u.id, u));
      }

      const likesData = localStorage.getItem(STORAGE_KEY_LIKES);
      if (likesData) {
        const arr: string[] = JSON.parse(likesData);
        arr.forEach(id => this.userLikes.add(id));
      }

      const statsData = localStorage.getItem(STORAGE_KEY_STATS);
      if (statsData) {
        const obj = JSON.parse(statsData);
        Object.entries(obj).forEach(([k, v]) => this.stats.set(k, v as any));
      }
    } catch (e) {
      console.error('MockApiClient: Failed to load from storage', e);
    }
  }

  private seedDefaultData(): void {
    // Ensure current user exists
    if (!this.users.has(CURRENT_USER_ID)) {
      this.users.set(CURRENT_USER_ID, {
        id: CURRENT_USER_ID,
        name: 'Player',
        avatarColor: 0x4ECDC4,
      });
    }

    // Ensure official user exists
    if (!this.users.has(OFFICIAL_USER_ID)) {
      this.users.set(OFFICIAL_USER_ID, {
        id: OFFICIAL_USER_ID,
        name: OFFICIAL_USER_NAME,
        avatarColor: 0x37A4E9, // Blue color for official
      });
    }

    // Seed default levels on first run only
    const alreadySeeded = localStorage.getItem(STORAGE_KEY_SEEDED);
    if (!alreadySeeded) {
      const defaultLevels = getDefaultLevels();
      defaultLevels.forEach(level => {
        if (!this.levels.has(level.id)) {
          this.levels.set(level.id, level);
        }
      });
      localStorage.setItem(STORAGE_KEY_SEEDED, 'true');
      this.saveToStorage();
    }
  }

  private saveToStorage(): void {
    localStorage.setItem(STORAGE_KEY_LEVELS, JSON.stringify(Array.from(this.levels.values())));
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(Array.from(this.users.values())));
    localStorage.setItem(STORAGE_KEY_LIKES, JSON.stringify(Array.from(this.userLikes)));
    localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(Object.fromEntries(this.stats)));
  }

  private delay(ms: number = 100): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== Levels ====================

  async getLevels(): Promise<LevelData[]> {
    await this.delay();
    return Array.from(this.levels.values())
      .filter(l => l.isPublished)
      .map(l => ({
        ...l,
        isLikedByCurrentUser: this.userLikes.has(l.id),
        ...this.stats.get(l.id),
      }));
  }

  async getLevel(levelId: string): Promise<LevelData | null> {
    await this.delay();
    const level = this.levels.get(levelId);
    if (!level) return null;
    return {
      ...level,
      isLikedByCurrentUser: this.userLikes.has(levelId),
      ...this.stats.get(levelId),
    };
  }

  async publishLevel(level: LevelData): Promise<void> {
    await this.delay();
    const toSave = {
      ...level,
      isPublished: true,
      createdAt: level.createdAt || Date.now(),
    };
    this.levels.set(level.id, toSave);
    this.saveToStorage();
  }

  async unpublishLevel(levelId: string): Promise<void> {
    await this.delay();
    const level = this.levels.get(levelId);
    if (level) {
      level.isPublished = false;
      this.saveToStorage();
    }
  }

  async deleteLevel(levelId: string): Promise<void> {
    await this.delay();
    this.levels.delete(levelId);
    this.stats.delete(levelId);
    this.saveToStorage();
  }

  async toggleLike(levelId: string): Promise<boolean> {
    await this.delay();
    const isLiked = this.userLikes.has(levelId);
    const level = this.levels.get(levelId);

    if (isLiked) {
      this.userLikes.delete(levelId);
      if (level) level.likes = Math.max(0, (level.likes || 0) - 1);
    } else {
      this.userLikes.add(levelId);
      if (level) level.likes = (level.likes || 0) + 1;
    }

    this.saveToStorage();
    return !isLiked;
  }

  async getLikeCount(levelId: string): Promise<number> {
    await this.delay();
    return this.levels.get(levelId)?.likes || 0;
  }

  // ==================== Users ====================

  async getCurrentUser(): Promise<UserProfile> {
    await this.delay();
    return this.users.get(CURRENT_USER_ID)!;
  }

  async updateCurrentUser(data: Partial<UserProfile>): Promise<UserProfile> {
    await this.delay();
    const current = this.users.get(CURRENT_USER_ID)!;
    const updated = { ...current, ...data };
    this.users.set(CURRENT_USER_ID, updated);
    this.saveToStorage();
    return updated;
  }

  async getUser(userId: string): Promise<UserProfile | null> {
    await this.delay();
    return this.users.get(userId) || null;
  }

  async getUserLevels(userId: string): Promise<LevelData[]> {
    await this.delay();
    return Array.from(this.levels.values())
      .filter(l => l.authorId === userId && l.isPublished)
      .map(l => ({
        ...l,
        isLikedByCurrentUser: this.userLikes.has(l.id),
      }));
  }

  // ==================== Stats ====================

  async recordAttempt(levelId: string): Promise<void> {
    await this.delay();
    const current = this.stats.get(levelId) || { attempts: 0, clears: 0 };
    current.attempts++;
    this.stats.set(levelId, current);
    this.saveToStorage();
  }

  async recordClear(levelId: string): Promise<void> {
    await this.delay();
    const current = this.stats.get(levelId) || { attempts: 0, clears: 0 };
    current.clears++;
    this.stats.set(levelId, current);
    this.saveToStorage();
  }

  // ==================== Auth ====================

  async loginWithGoogle(_token: string): Promise<{ token: string; user: UserProfile }> {
    await this.delay();
    // Simulate lookup or create
    return {
      token: 'mock_token',
      user: this.users.get(CURRENT_USER_ID)!
    };
  }

  async logout(): Promise<void> {
    await this.delay();
    // No-op
  }
}
