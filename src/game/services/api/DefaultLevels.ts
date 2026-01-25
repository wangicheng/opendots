import type { LevelData } from '../../levels/LevelSchema';
import level1 from '../../levels/level1.json';
import level2 from '../../levels/level2.json';
import level3 from '../../levels/level3.json';
import level4 from '../../levels/level4.json';
import level5 from '../../levels/level5.json';
import level6 from '../../levels/level6.json';
import level7 from '../../levels/level7.json';

// Official account that "uploaded" the tutorial levels
export const OFFICIAL_USER_ID = 'opendots_official';
export const OFFICIAL_USER_NAME = 'OpenDots';

/**
 * Default levels that appear as if uploaded by the official account.
 * These are seeded into MockApiClient on first run.
 */
export function getDefaultLevels(): LevelData[] {
  const now = Date.now();

  const addMetadata = (level: any, index: number): LevelData => ({
    ...level,
    author: OFFICIAL_USER_NAME,
    authorId: OFFICIAL_USER_ID,
    createdAt: now - (7 - index) * 86400000, // Stagger creation dates
    likes: Math.floor(Math.random() * 50) + 10,
    isPublished: true,
    authorPassed: true,
    attempts: Math.floor(Math.random() * 100) + 20,
    clears: Math.floor(Math.random() * 50) + 5,
  });

  return [
    addMetadata(level1, 0),
    addMetadata(level2, 1),
    addMetadata(level3, 2),
    addMetadata(level4, 3),
    addMetadata(level5, 4),
    addMetadata(level6, 5),
    addMetadata(level7, 6),
  ];
}
