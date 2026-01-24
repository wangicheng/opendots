/**
 * Level Data Schema
 * Defines the structure of a level JSON file
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface BallConfig {
  x: number;
  y: number;
}

// Shape types
export type ShapeType = 'rectangle' | 'square' | 'triangle' | 'circle' | 'c_shape' | 'bezier';


export interface ObstacleConfig {
  type?: ShapeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number; // For circle
  angle?: number; // Degrees
  points?: Vec2[]; // For c_shape, bezier, or triangle (3 coordinates)
  thickness?: number; // For c_shape or bezier
  cap?: 'round' | 'butt'; // Defaults to 'round' for c_shape or bezier
}

export interface NetConfig {
  x: number;         // Center X
  y: number;         // Center Y
  width: number;
  height: number;
  angle?: number;    // Degrees
}

export interface FallingObjectConfig {
  type?: ShapeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number; // For circle
  angle?: number;
  points?: Vec2[]; // For triangle (3 coordinates)
}

export interface IceBlockConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  meltTime?: number; // Default: 1 second
  angle?: number; // Degrees
}

export interface LaserConfig {
  x1: number; // Start point X
  y1: number; // Start point Y
  x2: number; // End point X
  y2: number; // End point Y
}

export interface SeesawConfig {
  x: number;         // Center X
  y: number;         // Center Y
  width: number;     // Plank width
  height: number;    // Plank height
  angle?: number;    // Initial angle (degrees)
}

export interface ConveyorBeltConfig {
  x: number;         // Center X
  y: number;         // Center Y
  width: number;     // Belt length (excluding semicircles)
  angle?: number;    // Rotation angle (degrees, default: 0)
  acceleration?: number;  // Acceleration (m/s², can be negative, default: CONVEYOR_BELT_ACCELERATION)
}

export interface ButtonConfig {
  x: number;         // Center X position
  y: number;         // Center Y position
  angle?: number;    // Rotation in degrees (default: 0, sinks downward)
}

export interface LevelData {
  id: string;
  originalId?: string; // Tracks the local ID of the level before publishing
  author?: string;
  authorId?: string;
  createdAt?: number;
  likes?: number;
  balls: {
    blue: BallConfig;
    pink: BallConfig;
  };
  obstacles: ObstacleConfig[];
  fallingObjects?: FallingObjectConfig[];
  nets?: NetConfig[];
  iceBlocks?: IceBlockConfig[];
  lasers?: LaserConfig[];
  seesaws?: SeesawConfig[];
  conveyors?: ConveyorBeltConfig[];
  buttons?: ButtonConfig[];
  authorPassed?: boolean;
  isPublished?: boolean;
  isLikedByCurrentUser?: boolean;
  issueId?: number;
}
