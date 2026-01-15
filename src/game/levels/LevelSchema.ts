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
export type ShapeType = 'rectangle' | 'square' | 'triangle' | 'circle' | 'c_shape';


export interface ObstacleConfig {
  type?: ShapeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number; // For circle
  angle?: number; // Degrees
  points?: Vec2[]; // For c_shape (3 coordinates)
  thickness?: number; // For c_shape
  cap?: 'round' | 'square'; // Defaults to 'round' for c_shape
}

export interface NetConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number; // Degrees
}

export interface FallingObjectConfig {
  type?: ShapeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number; // For circle
  angle?: number;
}

export interface IceBlockConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  meltTime?: 1 | 2 | 3; // Default: 1 second
  angle?: number; // Degrees
}

export interface LevelData {
  id: string;
  balls: {
    blue: BallConfig;
    pink: BallConfig;
  };
  obstacles: ObstacleConfig[];
  fallingObjects?: FallingObjectConfig[];
  nets?: NetConfig[];
  iceBlocks?: IceBlockConfig[];
}
