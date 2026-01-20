import type { LevelData } from '../levels/LevelSchema';
import level1 from '../levels/level1.json';
import level2 from '../levels/level2.json';
import level3 from '../levels/level3.json';
import level4 from '../levels/level4.json';
import level5 from '../levels/level5.json';
import level6 from '../levels/level6.json';
import level7 from '../levels/level7.json';

// Local storage key for custom levels
const STORAGE_KEY = 'braindots_custom_levels';
export const CURRENT_USER_ID = 'user_me';

export class MockLevelService {
  private static instance: MockLevelService;

  // Fake authors data
  private startTimestamp: number = Date.now() - 1000 * 60 * 60 * 24 * 30; // 30 days ago
  private authors = [
    { name: 'Alice', id: 'user_alice' },
    { name: 'Bob', id: 'user_bob' },
    { name: 'Charlie', id: 'user_charlie' },
    { name: 'Me', id: CURRENT_USER_ID }
  ];
  private builtinLevels: LevelData[] = [
    level1 as unknown as LevelData,
    level2 as unknown as LevelData,
    level3 as unknown as LevelData,
    level4 as unknown as LevelData,
    level5 as unknown as LevelData,
    level6 as unknown as LevelData,
    level7 as unknown as LevelData
  ];

  private constructor() { }

  public static getInstance(): MockLevelService {
    if (!MockLevelService.instance) {
      MockLevelService.instance = new MockLevelService();
    }
    return MockLevelService.instance;
  }

  /**
   * Get all levels (Built-in + User Uploaded)
   * Treating them all as "Community Levels"
   */
  public async getLevelList(): Promise<LevelData[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200));

    const storedLevels = this.getStoredLevels();

    // Combine built-in (treated as user uploads) and actual local "uploads"
    const rawList = [...this.builtinLevels, ...storedLevels];

    // Inject mock metadata for sorting/filtering demo if missing
    return rawList.map((level, index) => {
      if (!level.author) {
        // Deterministic mock data assignment based on index
        const authorObj = this.authors[index % this.authors.length];
        // Random-ish date and likes based on index to keep order consistent across reloads
        // Newest levels at the end of list usually, let's mix it up slightly
        const timeOffset = (index * 1234567) % (1000 * 60 * 60 * 24 * 30);

        return {
          ...level,
          author: authorObj.name,
          authorId: authorObj.id,
          createdAt: this.startTimestamp + timeOffset,
          likes: Math.floor((Math.sin(index) + 1) * 500) // 0 to 1000
        };
      }
      return level;
    });
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
    stored.push(level);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    console.log('Level uploaded:', level.id);
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
}
