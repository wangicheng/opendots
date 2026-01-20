import type { LevelData } from './LevelSchema';

/**
 * Level Manager
 * Handles loading and parsing of specific level data
 */
export class LevelManager {
  private currentLevel: LevelData | null = null;

  constructor() {
  }

  /**
   * Load a specific level from data object
   */
  async loadLevelData(data: LevelData): Promise<void> {
    this.currentLevel = data;
    // In future this handles validation or pre-processing
  }

  getCurrentLevel(): LevelData | null {
    return this.currentLevel;
  }
}
