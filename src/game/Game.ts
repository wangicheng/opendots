/**
 * Main Game Class
 * Orchestrates the game loop, physics, and rendering
 */

import * as PIXI from 'pixi.js';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { Ball } from './objects/Ball';
import { Obstacle } from './objects/Obstacle';
import { FallingObject } from './objects/FallingObject';
import { DrawnLine } from './objects/DrawnLine';
import { Net } from './objects/Net';
import { DrawingManager } from './input/DrawingManager';
import { LevelManager } from './levels/LevelManager';
import type { Point } from './utils/douglasPeucker';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  BACKGROUND_COLOR,
  GRID_SIZE,
  GRID_COLOR,
  BALL_COLORS,
  BALL_RADIUS,
} from './config';
import { EffectManager } from './effects/EffectManager';

export const GameState = {
  READY: 0,
  PLAYING: 1,
  WON: 2,
  LOST: 3,
} as const;
export type GameState = typeof GameState[keyof typeof GameState];

export class Game {
  private app: PIXI.Application;
  private physicsWorld: PhysicsWorld;
  private levelManager: LevelManager;
  private balls: Ball[] = [];
  private obstacles: Obstacle[] = [];
  private fallingObjects: FallingObject[] = [];
  private nets: Net[] = [];
  private drawnLines: DrawnLine[] = [];
  private drawingManager: DrawingManager | null = null;
  private gameContainer: PIXI.Container;
  private interactionArea: PIXI.Graphics;
  private hasStarted: boolean = false;
  private currentLevelIndex: number = 0;
  private effectManager: EffectManager;
  private gameState: GameState = GameState.READY;
  private autoRestartTimeout: ReturnType<typeof setTimeout> | null = null;

  // Collision handle mapping for ball detection
  private ballColliderHandles: Map<number, Ball> = new Map();

  constructor() {
    this.app = new PIXI.Application();
    this.physicsWorld = new PhysicsWorld();
    this.levelManager = new LevelManager();
    this.gameContainer = new PIXI.Container();
    this.interactionArea = new PIXI.Graphics();
    this.effectManager = new EffectManager(this.gameContainer);
  }

  /**
   * Initialize the game
   */
  async init(): Promise<void> {
    // Initialize Rapier.js WASM (must be done first)
    await this.physicsWorld.init();

    // Initialize Pixi.js application
    await this.app.init({
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: BACKGROUND_COLOR,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // Load assets
    await PIXI.Assets.load('/object_ami.png');

    console.log('Pixi initialized, adding canvas...');
    // Add canvas to DOM
    const container = document.getElementById('app');
    if (container) {
      container.appendChild(this.app.canvas);
    } else {
      document.body.appendChild(this.app.canvas);
    }

    // Setup game container
    this.app.stage.addChild(this.gameContainer);

    // Create background grid
    this.createBackground();

    // Create interaction area (invisible rectangle covering the canvas)
    this.interactionArea.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.interactionArea.fill({ color: 0xFFFFFF, alpha: 0 });
    this.interactionArea.zIndex = 0;
    this.gameContainer.addChild(this.interactionArea);
    this.gameContainer.sortableChildren = true;

    // Setup drawing
    this.setupDrawing();
    if (this.drawingManager) {
      this.drawingManager.getContainer().zIndex = 100;
    }

    // Create game objects
    await this.createGameObjects();

    // Create UI
    this.createUI();

    // Start game loop
    this.app.ticker.add(this.update.bind(this));
  }

  /**
   * Load the first level
   */
  private async createGameObjects(): Promise<void> {
    await this.loadLevel(0);
  }

  /**
   * Load level by index
   */
  async loadLevel(index: number): Promise<void> {
    const levelData = await this.levelManager.loadLevel(index);
    if (!levelData) {
      console.error('Failed to load level', index);
      return;
    }

    this.currentLevelIndex = index;

    // Clear existing dynamic objects
    this.clearLevel();

    // Spawn Balls
    const { blue, pink } = levelData.balls;
    const blueBall = new Ball(this.physicsWorld, blue.x, blue.y, 'blue', false);
    const pinkBall = new Ball(this.physicsWorld, pink.x, pink.y, 'pink', false);

    this.balls.push(blueBall, pinkBall);
    this.gameContainer.addChild(blueBall.graphics, pinkBall.graphics);

    // Map collider handles for collision detection
    this.ballColliderHandles.set(blueBall.getColliderHandle(), blueBall);
    this.ballColliderHandles.set(pinkBall.getColliderHandle(), pinkBall);

    // Spawn Obstacles
    for (const obs of levelData.obstacles) {
      const obstacle = new Obstacle(this.physicsWorld, obs);
      this.obstacles.push(obstacle);
      this.gameContainer.addChild(obstacle.graphics);
    }

    // Spawn Falling Objects
    if (levelData.fallingObjects) {
      for (const obj of levelData.fallingObjects) {
        const fallingObj = new FallingObject(this.physicsWorld, obj, false);
        this.fallingObjects.push(fallingObj);
        this.gameContainer.addChild(fallingObj.graphics);
      }
    }

    // Spawn Nets
    if (levelData.nets) {
      for (const netConfig of levelData.nets) {
        const net = new Net(netConfig);
        this.nets.push(net);
        this.gameContainer.addChild(net.graphics);
      }
    }

    // Force update of physics query acceleration structures
    // This is necessary because the game loop hasn't started stepping the world yet
    this.physicsWorld.getWorld().updateSceneQueries();

    // Update DrawingManager with collision provider
    if (this.drawingManager) {
      this.drawingManager.setCollisionProvider({
        isPointValid: (point: Point) => {
          // Check Nets
          for (const net of this.nets) {
            if (net.getBounds().contains(point.x, point.y)) return false;
          }

          // Check Physics Objects (Balls, Obstacles, Falling Objects, Lines)
          const physicsPos = this.physicsWorld.toPhysics(point.x, point.y);
          let isHit = false;
          this.physicsWorld.getWorld().intersectionsWithPoint(
            physicsPos,
            () => {
              isHit = true;
              return false;
            },
            undefined,
            0xFFFFFFFF
          );
          return !isHit;
        },
        getIntersection: (p1: Point, p2: Point): Point | null => {
          return this.checkIntersection(p1, p2);
        }
      });
    }
  }

  /**
   * Clear current level objects
   */
  private clearLevel(): void {
    if (this.autoRestartTimeout) {
      clearTimeout(this.autoRestartTimeout);
      this.autoRestartTimeout = null;
    }

    // Clear balls
    for (const ball of this.balls) {
      ball.destroy(this.physicsWorld);
    }
    this.balls = [];
    this.ballColliderHandles.clear();

    // Clear obstacles
    for (const obs of this.obstacles) {
      obs.destroy(this.physicsWorld);
    }
    this.obstacles = [];

    // Clear falling objects
    for (const obj of this.fallingObjects) {
      obj.destroy(this.physicsWorld);
    }
    this.fallingObjects = [];

    // Reset game state
    this.hasStarted = false;
    this.gameState = GameState.READY;
    this.effectManager.clear();

    // Clear nets
    for (const net of this.nets) {
      net.destroy();
    }
    this.nets = [];
    if (this.drawingManager) {
      this.drawingManager.setCollisionProvider({
        isPointValid: () => true,
        getIntersection: () => null
      });
    }

    // Clear drawn lines
    for (const line of this.drawnLines) {
      line.destroy(this.physicsWorld);
    }
    this.drawnLines = [];
  }

  /**
   * Setup drawing functionality
   */
  private setupDrawing(): void {
    this.drawingManager = new DrawingManager(this.gameContainer);
    this.drawingManager.enable(this.interactionArea, this.onLineDrawn.bind(this));
  }

  /**
   * Handle when a line is drawn
   */
  private onLineDrawn(points: Point[]): void {
    const line = new DrawnLine(this.physicsWorld, points);
    this.drawnLines.push(line);
    this.gameContainer.addChild(line.graphics);

    // Start game if not started
    if (!this.hasStarted) {
      this.hasStarted = true;
      this.gameState = GameState.PLAYING;
      this.balls.forEach(ball => ball.activate());
      this.fallingObjects.forEach(obj => obj.activate());
    }
  }

  /**
   * Create UI overlay
   */
  private createUI(): void {
    const container = document.getElementById('app');
    if (!container) return;

    // Ensure container is relative for absolute positioning of overlay
    container.style.position = 'relative';

    // UI Overlay Container
    const uiOverlay = document.createElement('div');
    uiOverlay.style.position = 'absolute';
    uiOverlay.style.top = '0';
    uiOverlay.style.left = '0';
    uiOverlay.style.width = '100%';
    uiOverlay.style.height = '100%';
    uiOverlay.style.pointerEvents = 'none';
    uiOverlay.style.zIndex = '10';

    // Restart Button
    const restartBtn = document.createElement('button');
    restartBtn.textContent = '🔄 Restart';
    restartBtn.style.pointerEvents = 'auto';
    restartBtn.style.position = 'absolute';
    restartBtn.style.top = '20px';
    restartBtn.style.right = '20px';
    restartBtn.style.padding = '8px 16px';
    restartBtn.style.fontSize = '16px';
    restartBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    restartBtn.style.color = 'white';
    restartBtn.style.border = '1px solid rgba(255, 255, 255, 0.4)';
    restartBtn.style.borderRadius = '20px';
    restartBtn.style.cursor = 'pointer';
    restartBtn.style.backdropFilter = 'blur(4px)';
    restartBtn.style.transition = 'all 0.2s ease';

    restartBtn.addEventListener('mouseenter', () => {
      restartBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
    });
    restartBtn.addEventListener('mouseleave', () => {
      restartBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    });

    restartBtn.addEventListener('click', () => {
      this.restartLevel();
    });

    uiOverlay.appendChild(restartBtn);
    container.appendChild(uiOverlay);
  }

  /**
   * Restart the current level
   */
  private async restartLevel(): Promise<void> {
    await this.loadLevel(this.currentLevelIndex);
  }

  /**
   * Process collision events from Rapier
   */
  private processCollisions(): void {
    if (this.gameState !== GameState.PLAYING) return;

    const eventQueue = this.physicsWorld.getEventQueue();

    eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      if (!started) return; // Only process collision start events

      const ball1 = this.ballColliderHandles.get(handle1);
      const ball2 = this.ballColliderHandles.get(handle2);

      // Check if both colliders are balls (blue and pink)
      if (ball1 && ball2) {
        // Get positions for effect
        const pos1 = ball1.body.translation();
        const pos2 = ball2.body.translation();
        const midX = (pos1.x + pos2.x) / 2;
        const midY = (pos1.y + pos2.y) / 2;

        const pixelPos = this.physicsWorld.toPixels(midX, midY);
        this.handleWin(pixelPos.x, pixelPos.y);
      }
    });
  }

  private checkBoundaries(): void {
    const margin = BALL_RADIUS * 2;
    const bounds = {
      minX: -margin,
      maxX: GAME_WIDTH + margin,
      maxY: GAME_HEIGHT + margin
    };

    for (const ball of this.balls) {
      const x = ball.graphics.position.x;
      const y = ball.graphics.position.y;

      if (x < bounds.minX || x > bounds.maxX || y > bounds.maxY) {
        let color = BALL_COLORS.blue;
        if (this.balls.indexOf(ball) === 1) color = BALL_COLORS.pink;

        this.handleLoss(x, y, color);
        return;
      }
    }
  }

  private handleWin(x: number, y: number): void {
    console.log('Game Won!');
    this.gameState = GameState.WON;

    const clampedX = Math.max(0, Math.min(x, GAME_WIDTH));
    const clampedY = Math.max(0, Math.min(y, GAME_HEIGHT));

    this.effectManager.createRingExplosion(clampedX, clampedY, 0xFFD700, 1);

    this.autoRestartTimeout = setTimeout(() => {
      this.restartLevel();
    }, 2000);
  }

  private handleLoss(x: number, y: number, color: number): void {
    console.log('Game Lost!');
    this.gameState = GameState.LOST;

    const clampedX = Math.max(0, Math.min(x, GAME_WIDTH));
    const clampedY = Math.max(0, Math.min(y, GAME_HEIGHT));

    this.effectManager.createRingExplosion(clampedX, clampedY, color, 1);

    this.autoRestartTimeout = setTimeout(() => {
      this.restartLevel();
    }, 2000);
  }

  /**
   * Main game loop update
   */
  private update(ticker: PIXI.Ticker): void {
    // Only update physics and game state if playing
    if (this.gameState !== GameState.PLAYING) return;

    // Step physics world
    const dt = ticker.deltaMS / 1000;
    this.physicsWorld.step(Math.min(dt, 1 / 30));

    // Process collision events
    this.processCollisions();

    this.checkBoundaries();

    // Update ball graphics from physics
    for (const ball of this.balls) {
      ball.update();
    }

    // Update falling objects graphics from physics
    for (const obj of this.fallingObjects) {
      obj.update();
    }

    // Update drawn lines graphics from physics
    for (const line of this.drawnLines) {
      line.update();
    }
  }

  /**
   * Create the background grid
   */
  private createBackground(): void {
    const gridGraphics = new PIXI.Graphics();

    const startX = (GAME_WIDTH / 2) % GRID_SIZE;
    const startY = (GAME_HEIGHT / 2) % GRID_SIZE;

    for (let x = startX; x <= GAME_WIDTH; x += GRID_SIZE) {
      gridGraphics.moveTo(x, 0);
      gridGraphics.lineTo(x, GAME_HEIGHT);
    }

    for (let y = startY; y <= GAME_HEIGHT; y += GRID_SIZE) {
      gridGraphics.moveTo(0, y);
      gridGraphics.lineTo(GAME_WIDTH, y);
    }

    gridGraphics.stroke({ width: 1, color: GRID_COLOR });

    this.gameContainer.addChildAt(gridGraphics, 0);
  }

  /**
   * Check intersection for drawing
   */
  private checkIntersection(p1: Point, p2: Point): Point | null {
    let closestIntersection: Point | null = null;
    let minDist = Infinity;

    // 1. Check Physics World (Raycast)
    const world = this.physicsWorld.getWorld();
    const R = this.physicsWorld.getRAPIER();

    const physP1 = this.physicsWorld.toPhysics(p1.x, p1.y);
    const physP2 = this.physicsWorld.toPhysics(p2.x, p2.y);

    const dx = physP2.x - physP1.x;
    const dy = physP2.y - physP1.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len > 0.001) {
      const dir = { x: dx / len, y: dy / len };
      const ray = new R.Ray({ x: physP1.x, y: physP1.y }, dir);

      // Cast ray against everything
      const hit = world.castRay(ray, len, true, undefined, 0xFFFFFFFF);

      if (hit) {
        const hitPoint = ray.pointAt(hit.timeOfImpact); // pointAt returns {x, y}
        const pixelHit = this.physicsWorld.toPixels(hitPoint.x, hitPoint.y);

        const dist = Math.sqrt((pixelHit.x - p1.x) ** 2 + (pixelHit.y - p1.y) ** 2);
        if (dist < minDist) {
          minDist = dist;
          closestIntersection = pixelHit;
        }
      }
    }

    // 2. Check Nets (AABB Intersection)
    for (const net of this.nets) {
      const bounds = net.getBounds();
      // Simple line-rect intersection for AABB
      const intersection = this.getLineRectIntersection(p1, p2, bounds);
      if (intersection) {
        const dist = Math.sqrt((intersection.x - p1.x) ** 2 + (intersection.y - p1.y) ** 2);
        if (dist < minDist) {
          minDist = dist;
          closestIntersection = intersection;
        }
      }
    }

    return closestIntersection;
  }

  /**
   * Helper for Line-Rect intersection
   */
  private getLineRectIntersection(p1: Point, p2: Point, rect: PIXI.Rectangle): Point | null {
    const left = rect.x;
    const right = rect.x + rect.width;
    const top = rect.y;
    const bottom = rect.y + rect.height;

    // If both outside and not crossing, quick reject?
    // Actually just check 4 edges.

    const edges = [
      [{ x: left, y: top }, { x: right, y: top }],
      [{ x: right, y: top }, { x: right, y: bottom }],
      [{ x: right, y: bottom }, { x: left, y: bottom }],
      [{ x: left, y: bottom }, { x: left, y: top }]
    ];

    let closest: Point | null = null;
    let minDist = Infinity;

    for (const edge of edges) {
      const p3 = edge[0];
      const p4 = edge[1];

      // Line-Line Intersection
      const den = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
      if (den === 0) continue;

      const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / den;
      const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / den;

      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        const ix = p1.x + t * (p2.x - p1.x);
        const iy = p1.y + t * (p2.y - p1.y);
        const dist = Math.sqrt((ix - p1.x) ** 2 + (iy - p1.y) ** 2);

        if (dist < minDist) {
          minDist = dist;
          closest = { x: ix, y: iy };
        }
      }
    }

    return closest;
  }

  /**
   * Get the Pixi.js application
   */
  getApp(): PIXI.Application {
    return this.app;
  }
}
