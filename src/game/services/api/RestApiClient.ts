import type { IApiClient } from './IApiClient';
import type { LevelData } from '../../levels/LevelSchema';
import type { UserProfile } from '../LevelService';
import { API_BASE_URL } from '../../config';

/**
 * REST API Client Implementation
 * Connects to the actual backend server.
 */
export class RestApiClient implements IApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const userId = localStorage.getItem('opendots_user_id');

    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId || '', // Pass user ID to backend
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text().catch(() => response.statusText);
      throw new Error(`API Error ${response.status}: ${error}`);
    }

    // Handle empty responses
    const text = await response.text();
    return text ? JSON.parse(text) : (undefined as unknown as T);
  }

  // ==================== Levels ====================

  async getLevels(): Promise<LevelData[]> {
    return this.request<LevelData[]>('/levels');
  }

  async getLevel(levelId: string): Promise<LevelData | null> {
    try {
      return await this.request<LevelData>(`/levels/${levelId}`);
    } catch (e) {
      console.warn('Failed to get level:', e);
      return null;
    }
  }

  async publishLevel(level: LevelData): Promise<void> {
    await this.request<void>(`/levels/${level.id}/publish`, {
      method: 'POST',
      body: JSON.stringify(level),
    });
  }

  async unpublishLevel(levelId: string): Promise<void> {
    await this.request<void>(`/levels/${levelId}/unpublish`, {
      method: 'POST',
    });
  }

  async deleteLevel(levelId: string): Promise<void> {
    await this.request<void>(`/levels/${levelId}`, {
      method: 'DELETE',
    });
  }

  async toggleLike(levelId: string): Promise<boolean> {
    const result = await this.request<{ liked: boolean }>(`/levels/${levelId}/like`, {
      method: 'POST',
    });
    return result.liked;
  }

  async getLikeCount(levelId: string): Promise<number> {
    const result = await this.request<{ count: number }>(`/levels/${levelId}/likes`);
    return result.count;
  }

  // ==================== Users ====================

  async getCurrentUser(): Promise<UserProfile> {
    return this.request<UserProfile>('/users/me');
  }

  async updateCurrentUser(data: Partial<UserProfile>): Promise<UserProfile> {
    return this.request<UserProfile>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getUser(userId: string): Promise<UserProfile | null> {
    try {
      return await this.request<UserProfile>(`/users/${userId}`);
    } catch (e) {
      console.warn('Failed to get user:', e);
      return null;
    }
  }

  async getUserLevels(userId: string): Promise<LevelData[]> {
    return this.request<LevelData[]>(`/users/${userId}/levels`);
  }

  // ==================== Stats ====================

  async recordAttempt(levelId: string): Promise<void> {
    await this.request<void>(`/levels/${levelId}/attempt`, {
      method: 'POST',
    });
  }

  async recordClear(levelId: string): Promise<void> {
    await this.request<void>(`/levels/${levelId}/clear`, {
      method: 'POST',
    });
  }
}
