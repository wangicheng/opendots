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
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // @ts-ignore
      ...(options.headers as Record<string, string>),
    };

    // Add Auth Token if available
    const token = localStorage.getItem('opendots_auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      // Fallback for public browsing or legacy
      const userId = localStorage.getItem('opendots_user_id');
      if (userId) {
        headers['x-user-id'] = userId;
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
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

  // ==================== Auth ====================

  async loginWithGoogle(token: string): Promise<{ token: string; user: UserProfile }> {
    return this.request<{ token: string; user: UserProfile }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async logout(): Promise<void> {
    try {
      await this.request<void>('/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Logout failed on server', e);
    }
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
