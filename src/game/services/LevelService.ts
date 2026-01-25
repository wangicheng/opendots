import type { LevelData } from '../levels/LevelSchema';
import type { IApiClient } from './api/IApiClient';
import { RestApiClient } from './api/RestApiClient';
import { MockApiClient } from './api/MockApiClient';

export const CURRENT_USER_ID = localStorage.getItem('opendots_user_id') || 'user_me';
const STORAGE_KEY_DRAFTS = 'opendots_draft_levels';
const STORAGE_KEY_PROFILE = 'opendots_user_profile';
const STORAGE_KEY_LIKES = 'opendots_user_likes';

// Set to true to use MockApiClient (localStorage), false for RestApiClient (real backend)
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

export interface UserProfile {
  id: string;
  name: string;
  avatarColor: number;
  avatarUrl?: string;
  githubUsername?: string;
}

export class LevelService {
  private static instance: LevelService;
  private api: IApiClient;
  private drafts: LevelData[] = [];
  private profile!: UserProfile;
  private likedLevelIds: Set<string> = new Set();

  // Cache for remote levels to avoid excessive fetching
  private remoteLevelsCache: LevelData[] | null = null;
  private remoteCacheTime: number = 0;
  private readonly CACHE_DURATION = 10000; // 10 seconds

  private constructor() {
    // Initialize API client based on environment
    this.api = USE_MOCK_API ? new MockApiClient() : new RestApiClient();

    this.loadDrafts();
    this.loadProfile();
    this.loadLikes();
  }

  public static getInstance(): LevelService {
    if (!LevelService.instance) {
      LevelService.instance = new LevelService();
    }
    return LevelService.instance;
  }

  /**
   * Get the underlying API client for direct access if needed.
   */
  public getApiClient(): IApiClient {
    return this.api;
  }

  private loadDrafts(): void {
    try {
      const item = localStorage.getItem(STORAGE_KEY_DRAFTS);
      this.drafts = item ? JSON.parse(item) : [];
    } catch (e) {
      console.error('Failed to load drafts', e);
      this.drafts = [];
    }
  }

  private saveDrafts(): void {
    localStorage.setItem(STORAGE_KEY_DRAFTS, JSON.stringify(this.drafts));
  }

  private loadProfile(): void {
    try {
      const item = localStorage.getItem(STORAGE_KEY_PROFILE);
      if (item) {
        this.profile = JSON.parse(item);
      } else {
        this.profile = {
          id: CURRENT_USER_ID,
          name: 'Player',
          avatarColor: 0x4ECDC4
        };
      }
    } catch (e) {
      this.profile = {
        id: CURRENT_USER_ID,
        name: 'Player',
        avatarColor: 0x4ECDC4
      };
    }
  }

  private loadLikes(): void {
    try {
      const item = localStorage.getItem(STORAGE_KEY_LIKES);
      if (item) {
        const ids = JSON.parse(item);
        if (Array.isArray(ids)) {
          this.likedLevelIds = new Set(ids);
        }
      }
    } catch (e) {
      console.error('Failed to load likes', e);
    }
  }

  public async getLevelList(forceRefresh: boolean = false): Promise<LevelData[]> {
    // 1. Fetch Remote Levels via API
    let remoteLevels: LevelData[] = [];

    // Check cache first
    const now = Date.now();
    if (!forceRefresh && this.remoteLevelsCache && (now - this.remoteCacheTime < this.CACHE_DURATION)) {
      remoteLevels = this.remoteLevelsCache;
    } else {
      try {
        remoteLevels = await this.api.getLevels();
        this.remoteLevelsCache = remoteLevels;
        this.remoteCacheTime = now;
      } catch (error) {
        console.warn('Network error fetching levels, falling back to local/builtin only', error);
      }
    }

    // 2. Combine with Drafts
    const processedRemote = remoteLevels.map(l => ({
      ...l,
      isLikedByCurrentUser: this.likedLevelIds.has(l.id)
    }));

    return [...this.drafts, ...processedRemote];
  }

  public async getLevelData(levelId: string): Promise<LevelData | null> {
    // Check drafts
    const draft = this.drafts.find(l => l.id === levelId);
    if (draft) return draft;

    // Fetch from API
    try {
      if (this.remoteLevelsCache) {
        const cached = this.remoteLevelsCache.find(l => l.id === levelId);
        if (cached) return cached;
      }

      const level = await this.api.getLevel(levelId);
      if (level) {
        return {
          ...level,
          isLikedByCurrentUser: this.likedLevelIds.has(level.id)
        };
      }
    } catch (error) {
      console.error('Failed to fetch level data', error);
    }
    return null;
  }

  public async saveLocalDraft(level: LevelData): Promise<void> {
    const index = this.drafts.findIndex(l => l.id === level.id);
    if (index >= 0) {
      this.drafts[index] = level;
    } else {
      this.drafts.push(level);
    }
    this.saveDrafts();
  }

  public async publishLevel(levelId: string): Promise<void> {
    const draft = this.drafts.find(l => l.id === levelId);
    if (!draft) {
      throw new Error('Level not found in drafts');
    }

    try {
      // Publish level (uploads data together with publish request)
      await this.api.publishLevel(draft);

      // Remove from local drafts since it's now on server
      const index = this.drafts.findIndex(l => l.id === levelId);
      if (index >= 0) {
        this.drafts.splice(index, 1);
        this.saveDrafts();
      }

      // Invalidate cache
      this.remoteLevelsCache = null;
    } catch (error) {
      console.error('Publish failed', error);
      throw error;
    }
  }

  public async unpublishLevel(levelId: string): Promise<void> {
    try {
      await this.api.unpublishLevel(levelId);
      this.remoteLevelsCache = null;
    } catch (error) {
      console.error('Unpublish failed', error);
      throw error;
    }
  }

  public async deleteLevel(levelId: string): Promise<void> {
    // Check drafts first
    const draftIndex = this.drafts.findIndex(l => l.id === levelId);
    if (draftIndex >= 0) {
      this.drafts.splice(draftIndex, 1);
      this.saveDrafts();
      return;
    }

    // Remote delete
    try {
      await this.api.deleteLevel(levelId);
      this.remoteLevelsCache = null;
    } catch (error) {
      console.warn('Failed to delete remote level', error);
    }
  }

  public async toggleLike(levelId: string): Promise<boolean> {
    const isLiked = this.likedLevelIds.has(levelId);
    const newStatus = !isLiked;

    // Optimistic update
    if (newStatus) {
      this.likedLevelIds.add(levelId);
    } else {
      this.likedLevelIds.delete(levelId);
    }
    localStorage.setItem(STORAGE_KEY_LIKES, JSON.stringify(Array.from(this.likedLevelIds)));

    // Sync with backend (fire and forget)
    try {
      await this.api.toggleLike(levelId);
    } catch (e) {
      // Revert on failure
      if (newStatus) {
        this.likedLevelIds.delete(levelId);
      } else {
        this.likedLevelIds.add(levelId);
      }
      localStorage.setItem(STORAGE_KEY_LIKES, JSON.stringify(Array.from(this.likedLevelIds)));
    }

    return newStatus;
  }

  // ==================== User Profile ====================

  public getUserProfile(): UserProfile {
    return this.profile;
  }

  public updateUserProfile(data: Partial<UserProfile>): UserProfile {
    this.profile = { ...this.profile, ...data };
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(this.profile));

    // Sync with backend
    this.api.updateCurrentUser(this.profile).catch(e => {
      console.warn('Failed to sync profile', e);
    });

    return this.profile;
  }

  // ==================== Stats ====================

  public async recordAttempt(levelId: string): Promise<void> {
    try {
      await this.api.recordAttempt(levelId);
    } catch (e) {
      console.warn('Failed to record attempt', e);
    }
  }

  public async recordClear(levelId: string): Promise<void> {
    try {
      await this.api.recordClear(levelId);
    } catch (e) {
      console.warn('Failed to record clear', e);
    }
  }
}
