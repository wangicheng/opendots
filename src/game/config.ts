/**
 * Game Configuration
 * Contains all game constants and physics parameters
 */

// Physics scale factor (pixels to physics world units)
export const SCALE = 60; // 60 pixels = 1 meter in physics world

// Canvas dimensions
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// Physics world settings
export const GRAVITY = -10; // Gravity pointing downward (in physics coordinates)
// Note: Rapier uses internal fixed timestep, no velocity/position iterations needed
export const FIXED_TIMESTEP = 1 / 60;

// Ball settings
export const BALL_RADIUS = 25; // pixels
export const BALL_COLORS = {
  blue: 0x3DBEEF,
  pink: 0xED86B4,
};

// Ball physics
export const BALL_DENSITY = 1.0;
export const BALL_FRICTION = 0.01;
export const BALL_RESTITUTION = 0.0;

// Obstacle settings (Static)
export const OBSTACLE_COLOR = 0x959595;
export const OBSTACLE_DENSITY = 50.0;
export const OBSTACLE_FRICTION = 0.5;
export const OBSTACLE_RESTITUTION = 0.0;

// Falling Object settings (Dynamic)
export const FALLING_OBJECT_COLOR = 0xC8C8C8;
export const FALLING_OBJECT_DENSITY = 1.0;
export const FALLING_OBJECT_FRICTION = 0.1;
export const FALLING_OBJECT_RESTITUTION = 0.0;

// Ice Block settings
export const ICE_BLOCK_COLOR = 0x83B0C9;
export const ICE_BLOCK_ALPHA = 0.5;

// Seesaw settings
export const SEESAW_COLOR = 0xC8C8C8;
export const SEESAW_PIVOT_COLOR = 0x959595;
export const SEESAW_DENSITY = 0.5;
export const SEESAW_FRICTION = 0.5;
export const SEESAW_RESTITUTION = 0.0;
export const SEESAW_ANGULAR_DAMPING = 0.0;
export const SEESAW_PIVOT_STIFFNESS = 1e4;  // Spring stiffness for soft pivot (higher = stiffer)
export const SEESAW_PIVOT_DAMPING = 1e-2;     // Spring damping (higher = less oscillation)

// Conveyor Belt settings
export const CONVEYOR_BELT_COLOR = 0xA9A9A9;
export const CONVEYOR_BELT_HEIGHT = 60;         // Fixed height in pixels
export const CONVEYOR_BELT_ACCELERATION = 15;   // Acceleration in physics units (m/s²) - all objects get same acceleration
export const CONVEYOR_BELT_VELOCITY_FACTOR = 1.0; // Max velocity = |acceleration| * this factor (default)
export const CONVEYOR_BELT_GEAR_SPEED_FACTOR = 1.0; // Gear rotation speed = |acceleration| × factor
export const CONVEYOR_BELT_FRICTION = 0.0;      // Friction for conveyor belt

// Background
export const BACKGROUND_COLOR = 0xF5F5F5;
export const GRID_SIZE = 36;
export const GRID_COLOR = 0xE0EFFF; // Light blue grid color

/**
 * Rapier Collision Groups
 * Format: 0xMMMMFFFF
 * MMMM = membership bits (what groups this belongs to)
 * FFFF = filter bits (what groups this can collide with)
 *
 * Converting from old CATEGORY bits:
 * - BLUE_BALL: 0x0002 -> membership: 0x0002, filter: 0xFFFF
 * - PINK_BALL: 0x0004 -> membership: 0x0004, filter: 0xFFFF
 * - etc.
 */
export const COLLISION_GROUP = {
  ALL: 0xFFFF_FFFF,             // Collide with everything
  BLUE_BALL: 0x0002_FFFF,       // Group 1, collides with all
  PINK_BALL: 0x0004_FFFF,       // Group 2, collides with all
  USER_LINE: 0x0008_FFFF,       // Group 3, collides with all
  GROUND: 0x0010_FFFF,          // Group 4, collides with all
  OBSTACLE: 0x0020_FFFF,        // Group 5, collides with all
  FALLING_OBJECT: 0x0040_FFFF,  // Group 6, collides with all
  NET: 0x0080_FFFF,             // Group 7, sensor that detects everything (so queries can find it)
  ICE_BLOCK: 0x0100_FFFF,       // Group 8, collides with all (for detection)
  LASER: 0x0200_FFFF,           // Group 9, sensor for laser hazard detection
  SEESAW: 0x0400_FFFF,          // Group 10, collides with all (rotating plank)
  CONVEYOR_BELT: 0x0800_FFFF,   // Group 11, sensor for conveyor belt
  BUTTON: 0x1000_FFFF,          // Group 12, sensor for button press detection
};

// Old CATEGORY export for backward compatibility (deprecated)
export const CATEGORY = {
  DEFAULT: 0x0001,
  BLUE_BALL: 0x0002,
  PINK_BALL: 0x0004,
  USER_LINE: 0x0008,
  GROUND: 0x0010,
  OBSTACLE: 0x0020,
  FALLING_OBJECT: 0x0040,
  NET: 0x0080,
};
