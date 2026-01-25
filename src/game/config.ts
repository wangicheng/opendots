/**
 * Game Configuration
 * Contains all game constants and physics parameters
 */

// Physics scale factor (pixels to physics world units)
export const SCALE = 60; // 60 pixels = 1 meter in physics world

// Canvas dimensions - Responsive System
export const ASPECT_RATIO = 16 / 9;

// Design reference dimensions (used for scaling calculations)
export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

// Current canvas dimensions (updated by Game.resize())
let currentWidth = DESIGN_WIDTH;
let currentHeight = DESIGN_HEIGHT;

/**
 * Get current canvas width
 */
export function getCanvasWidth(): number {
  return currentWidth;
}

/**
 * Get current canvas height
 */
export function getCanvasHeight(): number {
  return currentHeight;
}

/**
 * Update current canvas dimensions (called by Game.resize())
 */
export function setCanvasSize(width: number, height: number): void {
  currentWidth = width;
  currentHeight = height;
}

/**
 * Calculate optimal canvas size for the given container while maintaining 16:9 aspect ratio
 */
export function calculateCanvasSize(containerWidth: number, containerHeight: number): { width: number; height: number } {
  let width = containerWidth;
  let height = containerWidth / ASPECT_RATIO;

  if (height > containerHeight) {
    height = containerHeight;
    width = containerHeight * ASPECT_RATIO;
  }

  return { width: Math.floor(width), height: Math.floor(height) };
}

/**
 * Get scale factor relative to design dimensions
 */
export function getScaleFactor(): number {
  return currentWidth / DESIGN_WIDTH;
}

/**
 * Scale a value from design space to current canvas space
 */
export function scale(designValue: number): number {
  return designValue * getScaleFactor();
}

/**
 * Get a percentage of current canvas width
 */
export function vw(percent: number): number {
  return (percent / 100) * currentWidth;
}

/**
 * Get a percentage of current canvas height
 */
export function vh(percent: number): number {
  return (percent / 100) * currentHeight;
}

// Legacy exports for backward compatibility during transition
// TODO: Remove these after all usages are updated
export const GAME_WIDTH = DESIGN_WIDTH;
export const GAME_HEIGHT = DESIGN_HEIGHT;

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
export const BALL_FRICTION = 0.1;
export const BALL_RESTITUTION = 0.0;

// Button settings
export const BUTTON_COLOR = 0xA0A0A0;
export const BUTTON_THICKNESS = 5;
export const BUTTON_VERTICAL_BAR_HEIGHT = 40;
export const BUTTON_HORIZONTAL_BAR_WIDTH = 32;

// Net settings
export const NET_BORDER_COLOR = 0x808080;
export const NET_BORDER_WIDTH = 2;
export const NET_BORDER_ALPHA = 0.8;

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
export const SEESAW_DENSITY = 2;
export const SEESAW_FRICTION = 0.5;
export const SEESAW_RESTITUTION = 0.0;
export const SEESAW_ANGULAR_DAMPING = 0.0;
export const SEESAW_PIVOT_STIFFNESS = 5e5;  // Spring stiffness for soft pivot (higher = stiffer)
export const SEESAW_PIVOT_DAMPING = 0.5;       // Spring damping (higher = less oscillation)

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

// Common UI/Interaction colors
export const HIT_AREA_COLOR = 0xFFFFFF;
export const HIT_AREA_ALPHA = 0.001;

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

// Editor Selection
export const EDITOR_SELECTION_COLOR = 0x2196F3;
export const EDITOR_SELECTION_ALPHA = 0.5;
export const EDITOR_DRAG_ALPHA = 0.8;
export const EDITOR_OUTLINE_WIDTH_NORMAL = 2; // Fixed pixels
export const EDITOR_OUTLINE_WIDTH_FOCUSED = 5; // Fixed pixels

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

// Rendering Order (Z-Index)
// Lower values are rendered first (at the bottom)
export const Z_INDEX = {
  BACKGROUND: 0,
  BUTTON: 10,
  DRAWN_LINE: 20,
  LASER: 30,
  SEESAW: 40,
  BALL: 50,
  ICE_BLOCK: 60,
  OBSTACLE: 70,
  FALLING_OBJECT: 80,
  CONVEYOR_BELT: 90,
  NET: 100,
  // UI / Overlay elements
  UI_OVERLAY: 1000,
  DRAG_PREVIEW: 2000,
};

// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Google Auth Configuration
// TODO: Replace with your actual Client ID from Google Cloud Console
export const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
(window as any).GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID;

