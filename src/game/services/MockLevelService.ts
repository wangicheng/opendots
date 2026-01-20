import type { LevelData } from '../levels/LevelSchema';
import level1 from '../levels/level1.json';
import level2 from '../levels/level2.json';
import level3 from '../levels/level3.json';
import level4 from '../levels/level4.json';
import level5 from '../levels/level5.json';
import level6 from '../levels/level6.json';
import level7 from '../levels/level7.json';

// Local storage key for custom levels
const STORAGE_KEY = 'opendots_custom_levels';
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
  private publishedLevelIds: Set<string> = new Set();
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
    const list = rawList.map((level, index) => {
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
          likes: Math.floor((Math.sin(index) + 1) * 500), // 0 to 1000
          isPublished: this.publishedLevelIds.has(level.id) || true, // Default to published for everything else
          authorPassed: true
        };
      }
      return level;
    });

    // Add a specific "Draft" level for the current user to test the UI
    const draftLevel: LevelData = {
      ...this.builtinLevels[0],
      id: 'draft_level_01',
      author: 'Me',
      authorId: CURRENT_USER_ID,
      createdAt: Date.now(),
      likes: 0,
      isPublished: this.publishedLevelIds.has('draft_level_01') || false,
      authorPassed: false
    };

    // Add multiple mock levels for the current user to test the 6-item layout
    const userLevels: LevelData[] = [];
    for (let i = 1; i <= 5; i++) {
      const id = `mock_user_level_${i}`;
      userLevels.push({
        ...this.builtinLevels[i % this.builtinLevels.length],
        id: id,
        author: 'Me',
        authorId: CURRENT_USER_ID,
        createdAt: Date.now() - (i * 1000 * 60 * 60), // Decreasing time
        likes: i * 10,
        isPublished: this.publishedLevelIds.has(id) || (i > 2), // Some published, some drafts
        authorPassed: i > 1  // Some tested, some not
      });
    }

    // Insert draftLevel and userLevels at the beginning
    return [draftLevel, ...userLevels, ...list];
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

  /**
   * Publish a level
   */
  public async publishLevel(levelId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    this.publishedLevelIds.add(levelId);

    // Also update storage if it exists there
    const stored = this.getStoredLevels();
    const index = stored.findIndex(l => l.id === levelId);
    if (index >= 0) {
      stored[index].isPublished = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    }
    console.log('Level published:', levelId);
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
