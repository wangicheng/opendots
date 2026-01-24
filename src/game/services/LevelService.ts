import type { LevelData } from '../levels/LevelSchema';


// Local storage key for custom levels
const STORAGE_KEY = 'opendots_custom_levels';
const LIKES_KEY = 'opendots_user_likes';
const DELETED_KEY = 'opendots_deleted_levels';
const PROFILE_KEY = 'opendots_user_profile';
export const CURRENT_USER_ID = 'user_me';

export interface UserProfile {
  id: string;
  name: string;
  avatarColor: number;
  avatarUrl?: string;
  githubUsername?: string;
}

export class LevelService {
  private static instance: LevelService;

  // Fake authors data

  private publishedLevelIds: Set<string> = new Set();
  private likedLevelIds: Set<string> = new Set();
  private deletedLevelIds: Set<string> = new Set();

  private constructor() {
    this.loadLikes();
    this.loadDeleted();

    // Ensure "Me" is replaced with actual profile name
    // const profile = this.getUserProfile();
    // const meIndex = this.authors.findIndex(a => a.id === CURRENT_USER_ID);
    // if (meIndex >= 0) {
    //   this.authors[meIndex].name = profile.name;
    // }
  }

  public static getInstance(): LevelService {
    if (!LevelService.instance) {
      LevelService.instance = new LevelService();
    }
    return LevelService.instance;
  }

  /**
   * Get all levels (Built-in + User Uploaded)
   * Treating them all as "Community Levels"
   */
  public async getLevelList(): Promise<LevelData[]> {
    // 1. Get Local Levels (Drafts, Untested, Your works)
    // Filter out published levels from local storage, as we want to source them from GitHub
    const localLevels = this.getStoredLevels()
      .map(l => ({
        ...l,
        author: l.author || 'Me',
        authorId: l.authorId || CURRENT_USER_ID,
        isPublished: false
      }));

    // 2. Fetch Remote Levels (Community)
    let remoteLevels: LevelData[] = [];
    try {
      const DB_URL = 'https://raw.githubusercontent.com/wangicheng/opendots/refs/heads/database/data.json';
      const res = await fetch(DB_URL);
      if (res.ok) {
        const db = await res.json();
        if (db.users) {
          Object.keys(db.users).forEach(username => {
            const user = db.users[username];
            if (user.levels && Array.isArray(user.levels)) {
              user.levels.forEach((level: any) => {
                // Validate level data integrity if needed

                // Namespace ID to prevent collision and ensure ownership
                // Format: username#original_id
                const namespacedLevel = {
                  ...level,
                  // If the level has an ID from the issue (e.g. numeric), preserve it or namespace it?
                  // The user wants the issue ID to be the level ID.
                  // Assuming the DB stores the level with the issue ID as its ID.
                  // We might still namespace it to be safe, or trust the ID if unique enough.
                  // Let's stick to namespacing to avoid collision with local drafts.
                  id: `${username}#${level.id}`,
                  originalId: level.originalId || level.id,
                  author: username, // Force author name to be the GitHub username
                  authorId: username, // Force authorId to be the GitHub username
                  isPublished: true, // It is from the public DB
                  isLikedByCurrentUser: false // Reset for generic
                };
                remoteLevels.push(namespacedLevel as LevelData);
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn('Failed to fetch community levels', e);
    }


    // 3. Combine with Difference Set Logic
    // "IsPublished" is determined by whether the level exists in the Cloud list.
    // If a local level ID (draft) appears as an 'originalId' in the remote list, it is effectively published.
    // We filter out the *local* copy so the user only sees the *published* (remote) one.

    const remoteOriginalIds = new Set(remoteLevels.map(r => String(r.originalId)).filter(Boolean));
    const drafts = localLevels.filter(l => !remoteOriginalIds.has(String(l.id)));

    // Combine: Drafts (Local-Unique) + Published (Remote)
    const all = [...drafts, ...remoteLevels].filter(l => !this.deletedLevelIds.has(l.id));

    return all;
  }

  /**
   * Get specific level data by ID
   */
  public async getLevelData(levelId: string): Promise<LevelData | null> {
    await new Promise(resolve => setTimeout(resolve, 100));

    const all = await this.getLevelList();
    return all.find(l => l.id === levelId) || null;
  }

  /**
   * Simulate uploading a level
   */
  public async uploadLevel(level: LevelData): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));

    const stored = this.getStoredLevels();
    const index = stored.findIndex(l => l.id === level.id);

    // Sanitize: Don't store author info or published status locally
    const { author, authorId, isPublished, ...levelToSave } = level;

    // We can cast back to LevelData (it's valid to have these optional)
    const sanitizedLevel = levelToSave as LevelData;

    if (index >= 0) {
      stored[index] = sanitizedLevel;
    } else {
      stored.push(sanitizedLevel);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }

  /**
   * Publish a level
   */
  public async publishLevel(levelId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    this.publishedLevelIds.add(levelId);

    // We do NOT store isPublished state locally.
    // It is ephemeral until confirmed by the cloud (GitHub).
  }

  private getStoredLevels(): LevelData[] {
    try {
      const item = localStorage.getItem(STORAGE_KEY);
      return item ? JSON.parse(item) : [];
    } catch (e) {
      console.error('Failed to parse stored levels', e);
      return [];
    }
  }

  private loadLikes(): void {
    try {
      const item = localStorage.getItem(LIKES_KEY);
      if (item) {
        const ids = JSON.parse(item);
        if (Array.isArray(ids)) {
          ids.forEach(id => this.likedLevelIds.add(id));
        }
      }
    } catch (e) {
      console.error('Failed to parse likes', e);
    }
  }

  public async toggleLike(levelId: string): Promise<boolean> {
    // No async needed strictly but good to keep interface uniform
    const isLiked = this.likedLevelIds.has(levelId);
    if (isLiked) {
      this.likedLevelIds.delete(levelId);
    } else {
      this.likedLevelIds.add(levelId);
    }
    localStorage.setItem(LIKES_KEY, JSON.stringify(Array.from(this.likedLevelIds)));
    return !isLiked;
  }

  public async deleteLevel(levelId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));

    const stored = this.getStoredLevels();
    const index = stored.findIndex(l => l.id === levelId);

    // Always track as deleted even if not in storage (for mock built-ins)
    this.deletedLevelIds.add(levelId);
    localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(this.deletedLevelIds)));

    if (index >= 0) {
      stored.splice(index, 1);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    }
  }

  private loadDeleted(): void {
    try {
      const item = localStorage.getItem(DELETED_KEY);
      if (item) {
        const ids = JSON.parse(item);
        if (Array.isArray(ids)) {
          ids.forEach(id => this.deletedLevelIds.add(id));
        }
      }
    } catch (e) {
      console.error('Failed to parse deleted levels', e);
    }
  }

  public getUserProfile(): UserProfile {
    try {
      const item = localStorage.getItem(PROFILE_KEY);
      if (item) {
        return JSON.parse(item);
      }
    } catch (e) {
      console.error('Failed to parse user profile', e);
    }

    // Default Profile
    return {
      id: CURRENT_USER_ID,
      name: 'Player',
      avatarColor: 0x4ECDC4 // Default Teal
    };
  }

  public updateUserProfile(data: Partial<UserProfile>): UserProfile {
    const current = this.getUserProfile();
    const updated = { ...current, ...data };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));

    // Also update hardcoded authors list if needed
    // const meIndex = this.authors.findIndex(a => a.id === CURRENT_USER_ID);
    // if (meIndex >= 0) {
    //   this.authors[meIndex].name = updated.name;
    // }

    // Update author name in all stored levels owned by current user
    if (data.name) {
      const stored = this.getStoredLevels();
      let changed = false;
      stored.forEach(level => {
        if (level.authorId === CURRENT_USER_ID) {
          level.author = updated.name;
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      }
    }

    return updated;
  }
}
