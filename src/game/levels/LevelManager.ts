import type { LevelData } from './LevelSchema';
import level1 from './level1.json';
import level2 from './level2.json';
import level3 from './level3.json';
import level4 from './level4.json';
import level5 from './level5.json';
import level6 from './level6.json';

/**
 * Level Manager
 * Handles loading and parsing of levels
 */
export class LevelManager {
  private currentLevelIndex: number = 0;

  // In a real app we might fetch these or load dynamically.
  // For now, we'll hardcode the list of imports.
  private levels: LevelData[] = [
    level1 as unknown as LevelData,
    level2 as unknown as LevelData,
    level3 as unknown as LevelData,
    level4 as unknown as LevelData,
    level5 as unknown as LevelData,
    level6 as unknown as LevelData
  ];

  constructor() {
  }

  /**
   * Load a specific level by ID or index
   */
  async loadLevel(index: number): Promise<LevelData | null> {
    if (index < 0 || index >= this.levels.length) {
      console.warn(`Level index ${index} out of bounds`);
      return null;
    }

    this.currentLevelIndex = index;
    return this.levels[index];
  }

  getCurrentLevel(): LevelData {
    return this.levels[this.currentLevelIndex];
  }
}
