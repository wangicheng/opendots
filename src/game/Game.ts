/**
 * Main Game Class
 * Orchestrates the game loop, physics, and rendering
 */

import * as PIXI from 'pixi.js';
import RAPIER from '@dimforge/rapier2d-compat';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { Ball } from './objects/Ball';
import { Obstacle } from './objects/Obstacle';
import { FallingObject } from './objects/FallingObject';
import { DrawnLine } from './objects/DrawnLine';
import { Net } from './objects/Net';
import { IceBlock } from './objects/IceBlock';
import { Laser } from './objects/Laser';
import { Seesaw } from './objects/Seesaw';
import { ConveyorBelt } from './objects/ConveyorBelt';
import { Button } from './objects/Button';
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
  COLLISION_GROUP,
  LINE_WIDTH,
  SCALE,
  FIXED_TIMESTEP,
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
  private iceBlocks: IceBlock[] = [];
  private lasers: Laser[] = [];
  private seesaws: Seesaw[] = [];
  private conveyors: ConveyorBelt[] = [];
  private buttons: Button[] = [];
  private drawnLines: DrawnLine[] = [];
  private drawingManager: DrawingManager | null = null;
  private gameContainer: PIXI.Container;
  private interactionArea: PIXI.Graphics;
  private hasStarted: boolean = false;
  private currentLevelIndex: number = 0;
  private effectManager: EffectManager;
  private gameState: GameState = GameState.READY;
  private autoRestartTimeout: ReturnType<typeof setTimeout> | null = null;
  private accumulator: number = 0;


  // Collision handle mapping for ball detection
  private ballColliderHandles: Map<number, Ball> = new Map();
  private iceBlockColliderHandles: Map<number, IceBlock> = new Map();
  private laserColliderHandles: Map<number, Laser> = new Map();
  private conveyorHandles: Map<number, ConveyorBelt> = new Map();
  private drawnLineColliderHandles: Map<number, DrawnLine> = new Map();
  private fallingObjectColliderHandles: Map<number, FallingObject> = new Map();
  private seesawColliderHandles: Map<number, Seesaw> = new Map();
  private buttonColliderHandles: Map<number, Button> = new Map();
  private activeConveyorContacts: { body: RAPIER.RigidBody, objectColliderHandle: number, conveyor: ConveyorBelt }[] = [];


  // Laser texture (loaded once, shared by all lasers)
  private laserTexture: PIXI.Texture | null = null;

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
    this.laserTexture = await PIXI.Assets.load('/laser.png');

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
    await this.loadLevel(5);
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
        this.fallingObjectColliderHandles.set(fallingObj.getColliderHandle(), fallingObj);
      }
    }

    // Spawn Nets
    if (levelData.nets) {
      for (const netConfig of levelData.nets) {
        const net = new Net(this.physicsWorld, netConfig);
        this.nets.push(net);
        this.gameContainer.addChild(net.graphics);
      }
    }

    // Spawn Ice Blocks
    if (levelData.iceBlocks) {
      for (const config of levelData.iceBlocks) {
        const iceBlock = new IceBlock(this.physicsWorld, config);
        this.iceBlocks.push(iceBlock);
        this.gameContainer.addChild(iceBlock.graphics);
        this.iceBlockColliderHandles.set(iceBlock.getColliderHandle(), iceBlock);
      }
    }

    // Spawn Lasers
    if (levelData.lasers && this.laserTexture) {
      for (const config of levelData.lasers) {
        const laser = new Laser(this.physicsWorld, config, this.laserTexture);
        this.lasers.push(laser);
        this.gameContainer.addChild(laser.graphics);
        this.laserColliderHandles.set(laser.getColliderHandle(), laser);
      }
    }

    // Spawn Seesaws
    if (levelData.seesaws) {
      for (const config of levelData.seesaws) {
        const seesaw = new Seesaw(this.physicsWorld, config);
        this.seesaws.push(seesaw);
        this.gameContainer.addChild(seesaw.graphics);
        this.seesawColliderHandles.set(seesaw.getColliderHandle(), seesaw);
      }
    }

    // Spawn Conveyor Belts
    if (levelData.conveyors) {
      for (const config of levelData.conveyors) {
        const conveyor = new ConveyorBelt(this.physicsWorld, config);
        this.conveyors.push(conveyor);
        this.gameContainer.addChild(conveyor.graphics);
        this.conveyorHandles.set(conveyor.getColliderHandle(), conveyor);
      }
    }

    // Spawn Buttons
    if (levelData.buttons) {
      for (const config of levelData.buttons) {
        const button = new Button(this.physicsWorld, config);
        this.buttons.push(button);
        this.gameContainer.addChild(button.graphics);
        for (const handle of button.getColliderHandles()) {
          this.buttonColliderHandles.set(handle, button);
        }
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
          // Net check is now covered by Physics World intersection check below

          // Check Physics Objects (Balls, Obstacles, Falling Objects, Lines)
          const physicsPos = this.physicsWorld.toPhysics(point.x, point.y);
          let isHit = false;
          this.physicsWorld.getWorld().intersectionsWithPoint(
            physicsPos,
            () => {
              isHit = true;
              return false;
            },
            COLLISION_GROUP.ALL
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
    this.fallingObjectColliderHandles.clear();

    // Reset game state
    this.hasStarted = false;
    this.gameState = GameState.READY;
    this.effectManager.clear();

    // Clear nets
    for (const net of this.nets) {
      net.destroy(this.physicsWorld);
    }
    this.nets = [];

    // Clear ice blocks
    for (const iceBlock of this.iceBlocks) {
      iceBlock.destroy(this.physicsWorld);
    }
    this.iceBlocks = [];
    this.iceBlockColliderHandles.clear();

    // Clear lasers
    for (const laser of this.lasers) {
      laser.destroy(this.physicsWorld);
    }
    this.lasers = [];
    this.laserColliderHandles.clear();

    // Clear seesaws
    for (const seesaw of this.seesaws) {
      seesaw.destroy(this.physicsWorld);
    }
    this.seesaws = [];
    this.seesawColliderHandles.clear();

    // Clear conveyor belts
    for (const conveyor of this.conveyors) {
      conveyor.destroy(this.physicsWorld);
    }
    this.conveyors = [];
    this.conveyorHandles.clear();
    this.activeConveyorContacts = [];

    // Clear buttons
    for (const button of this.buttons) {
      button.destroy(this.physicsWorld);
    }
    this.buttons = [];
    this.buttonColliderHandles.clear();



    if (this.drawingManager) {
      this.drawingManager.cancelDrawing();
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
    this.drawnLineColliderHandles.clear();
  }

  /**
   * Setup drawing functionality
   */
  private setupDrawing(): void {
    this.drawingManager = new DrawingManager(this.gameContainer);
    this.drawingManager.enable(
      this.interactionArea,
      this.onLineDrawn.bind(this),
      this.startGame.bind(this)
    );
  }

  /**
   * Start the game simulation
   */
  private startGame(): void {
    if (!this.hasStarted) {
      this.hasStarted = true;
      this.gameState = GameState.PLAYING;
      this.balls.forEach(ball => ball.activate());
      this.fallingObjects.forEach(obj => obj.activate());
    }
  }

  /**
   * Handle when a line is drawn
   */
  private onLineDrawn(points: Point[]): void {
    const line = new DrawnLine(this.physicsWorld, points);
    this.drawnLines.push(line);
    this.gameContainer.addChild(line.graphics);

    // Register all colliders for conveyor detection
    for (const collider of line.colliders) {
      this.drawnLineColliderHandles.set(collider.handle, line);
    }

    // Start game if not started (redundant with onDrawingEnd but safe)
    this.startGame();
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
      if (started) {
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

        // Check for ice block collisions
        const iceBlock1 = this.iceBlockColliderHandles.get(handle1);
        const iceBlock2 = this.iceBlockColliderHandles.get(handle2);

        // If one of the colliders is an ice block, start melting it
        if (iceBlock1 && !iceBlock1.getIsMelting()) {
          iceBlock1.startMelting();
        }
        if (iceBlock2 && !iceBlock2.getIsMelting()) {
          iceBlock2.startMelting();
        }

        // Check for laser collisions with balls
        const laser1 = this.laserColliderHandles.get(handle1);
        const laser2 = this.laserColliderHandles.get(handle2);
        const ballHitByLaser = (laser1 && ball2) || (laser2 && ball1);

        if (ballHitByLaser) {
          const hitBall = ball1 || ball2;
          if (hitBall) {
            this.handleLoss(hitBall);
          }
        }

        // Check for button collisions with balls
        const button1 = this.buttonColliderHandles.get(handle1);
        const button2 = this.buttonColliderHandles.get(handle2);
        const ballHitButton = (button1 && ball2) || (button2 && ball1);

        if (ballHitButton) {
          this.triggerButtonPress();
        }
      }

      // Check for conveyor collisions with balls and drawn lines
      const conv1 = this.conveyorHandles.get(handle1);
      const conv2 = this.conveyorHandles.get(handle2);
      const convBall1 = this.ballColliderHandles.get(handle1);
      const convBall2 = this.ballColliderHandles.get(handle2);
      const convLine1 = this.drawnLineColliderHandles.get(handle1);
      const convLine2 = this.drawnLineColliderHandles.get(handle2);
      const convFall1 = this.fallingObjectColliderHandles.get(handle1);
      const convFall2 = this.fallingObjectColliderHandles.get(handle2);
      const convSeesaw1 = this.seesawColliderHandles.get(handle1);
      const convSeesaw2 = this.seesawColliderHandles.get(handle2);

      // Identify the pair (conveyor + ball or line or falling object or seesaw)
      let conveyorContact: { conv: ConveyorBelt, body: RAPIER.RigidBody, objectColliderHandle: number } | null = null;

      if (conv1 && convBall2) {
        conveyorContact = { conv: conv1, body: convBall2.body, objectColliderHandle: handle2 };
      } else if (conv2 && convBall1) {
        conveyorContact = { conv: conv2, body: convBall1.body, objectColliderHandle: handle1 };
      } else if (conv1 && convLine2) {
        conveyorContact = { conv: conv1, body: convLine2.body, objectColliderHandle: handle2 };
      } else if (conv2 && convLine1) {
        conveyorContact = { conv: conv2, body: convLine1.body, objectColliderHandle: handle1 };
      } else if (conv1 && convFall2) {
        conveyorContact = { conv: conv1, body: convFall2.body, objectColliderHandle: handle2 };
      } else if (conv2 && convFall1) {
        conveyorContact = { conv: conv2, body: convFall1.body, objectColliderHandle: handle1 };
      } else if (conv1 && convSeesaw2) {
        conveyorContact = { conv: conv1, body: convSeesaw2.plankBody, objectColliderHandle: handle2 };
      } else if (conv2 && convSeesaw1) {
        conveyorContact = { conv: conv2, body: convSeesaw1.plankBody, objectColliderHandle: handle1 };
      }

      if (conveyorContact) {
        if (started) {
          // Add contact (avoid duplicates for exactly same pair)
          const exists = this.activeConveyorContacts.some(
            c => c.objectColliderHandle === conveyorContact!.objectColliderHandle && c.conveyor === conveyorContact!.conv
          );
          if (!exists) {
            this.activeConveyorContacts.push({
              body: conveyorContact.body,
              conveyor: conveyorContact.conv,
              objectColliderHandle: conveyorContact.objectColliderHandle
            });
          }
        } else {
          // Remove contact
          this.activeConveyorContacts = this.activeConveyorContacts.filter(
            c => c.objectColliderHandle !== conveyorContact!.objectColliderHandle || c.conveyor !== conveyorContact!.conv
          );
        }
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
      const pos = ball.body.translation();
      const pixelPos = this.physicsWorld.toPixels(pos.x, pos.y);
      const x = pixelPos.x;
      const y = pixelPos.y;

      if (x < bounds.minX || x > bounds.maxX || y > bounds.maxY) {
        this.handleLoss(ball);
        return;
      }
    }
  }


  /**
   * Apply acceleration to a rigid body from a conveyor belt using accurate Contact Manifolds
   * This ensures forces are applied at the exact contact points, producing correct torque and linear motion.
   */
  private applyAcceleration(contact: { body: RAPIER.RigidBody, objectColliderHandle: number, conveyor: ConveyorBelt }, dt: number): void {
    const { body, objectColliderHandle, conveyor } = contact;
    const world = this.physicsWorld.getWorld();

    // Retrieve the specific collider for the object that is touching the conveyor
    let objectCollider: RAPIER.Collider;
    try {
      objectCollider = world.getCollider(objectColliderHandle);
    } catch (e) {
      // Collider might have been removed
      return;
    }

    if (!objectCollider || !objectCollider.isValid()) return;

    const conveyorCollider = conveyor.topCollider;

    // Use Rapier's contactPair to access the manifold
    world.contactPair(conveyorCollider, objectCollider, (manifold, flipped) => {
      const numPoints = manifold.numContacts();
      if (numPoints === 0) return;

      const maxVelocity = conveyor.maxVelocity;
      // Distribute force: F = m * a. We divide by numPoints to not overpower multiple contacts.
      const forcePerPoint = (Math.abs(conveyor.acceleration) * body.mass()) / numPoints;

      const dirSign = Math.sign(conveyor.acceleration) || 1;

      // 2. Iterate all contact points
      for (let i = 0; i < numPoints; i++) {
        // Get local contact point
        // If flipped=false: localPoint1 is on conveyor, localPoint2 on object
        // If flipped=true: localPoint1 is on object, localPoint2 on conveyor
        let localPt, refBody;

        let normalX = 0;
        let normalY = 0;

        // Rapier manifold.normal() returns world space normal from Shape 1 to Shape 2
        // We want the normal POINTING OUT of the Conveyor Surface.
        const worldNormal = manifold.normal();

        if (flipped) {
          // Shape 1 = Object, Shape 2 = Conveyor. Normal: Object -> Conveyor (Into Conveyor)
          // We want normal Out of Conveyor. So we invert it.
          normalX = -worldNormal.x;
          normalY = -worldNormal.y;

          localPt = manifold.localContactPoint2(i);
          refBody = conveyor.body;
        } else {
          // Shape 1 = Conveyor, Shape 2 = Object. Normal: Conveyor -> Object (Out of Conveyor)
          // This is correct.
          normalX = worldNormal.x;
          normalY = worldNormal.y;

          localPt = manifold.localContactPoint1(i);
          refBody = conveyor.body;
        }

        if (!localPt) continue;

        // Calculate Tangent Direction from Normal
        // Rotate -90 degrees (Clockwise): (x, y) -> (y, -x)
        let tangentX = normalY;
        let tangentY = -normalX;

        // Apply direction sign
        tangentX *= dirSign;
        tangentY *= dirSign;

        // Transform local point to World Space manually
        const refPos = refBody.translation();
        const refRot = refBody.rotation();
        const sin = Math.sin(refRot);
        const cos = Math.cos(refRot);

        const worldX = (localPt.x * cos - localPt.y * sin) + refPos.x;
        const worldY = (localPt.x * sin + localPt.y * cos) + refPos.y;

        // 3. Check Velocity at this Contact Point (Manual Calculation)
        // v_point = v_com + w x r
        // r = point - com
        const bodyLinVel = body.linvel();
        const bodyAngVel = body.angvel();
        const bodyPos = body.translation();

        // r vector from COM to contact point
        const rx = worldX - bodyPos.x;
        const ry = worldY - bodyPos.y;

        // w x r = (-w * ry, w * rx) in 2D
        const pointVelX = bodyLinVel.x - bodyAngVel * ry;
        const pointVelY = bodyLinVel.y + bodyAngVel * rx;

        // Project velocity onto the desired tangent direction
        const currentTanVel = pointVelX * tangentX + pointVelY * tangentY;

        // 4. Apply Force if below max velocity
        if (currentTanVel < maxVelocity) {
          // Apply impulse at center of mass (no torque)
          const fx = tangentX * forcePerPoint * dt;
          const fy = tangentY * forcePerPoint * dt;

          body.applyImpulse({ x: fx, y: fy }, true);
        }
      }
    });
  }

  private handleWin(x: number, y: number): void {
    console.log('Game Won!');
    this.gameState = GameState.WON;

    const clampedX = Math.max(0, Math.min(x, GAME_WIDTH));
    const clampedY = Math.max(0, Math.min(y, GAME_HEIGHT));

    this.effectManager.createRingExplosion(clampedX, clampedY, 0xFFD700, 1);
    this.effectManager.createParticleExplosion(clampedX, clampedY, 0xFFD700, 'star');

    this.autoRestartTimeout = setTimeout(() => {
      this.restartLevel();
    }, 2000);
  }

  private handleLoss(ball: Ball): void {
    if (!this.balls.includes(ball)) return;

    console.log('Game Lost!');
    this.gameState = GameState.LOST;

    const pos = ball.body.translation();
    const pixelPos = this.physicsWorld.toPixels(pos.x, pos.y);
    const color = BALL_COLORS[ball.type];

    // Remove ball
    ball.destroy(this.physicsWorld);
    const index = this.balls.indexOf(ball);
    if (index > -1) this.balls.splice(index, 1);
    this.ballColliderHandles.delete(ball.getColliderHandle());

    // Also remove from active conveyor contacts
    this.activeConveyorContacts = this.activeConveyorContacts.filter(c => c.body !== ball.body);


    // Calculate clamped position for effects (so they are visible if ball is out of bounds)
    const clampedX = Math.max(0, Math.min(pixelPos.x, GAME_WIDTH));
    const clampedY = Math.max(0, Math.min(pixelPos.y, GAME_HEIGHT));

    // Trigger effects
    this.effectManager.createRingExplosion(clampedX, clampedY, color, 1);
    this.effectManager.createParticleExplosion(clampedX, clampedY, color, 'circle');

    if (!this.autoRestartTimeout) {
      this.autoRestartTimeout = setTimeout(() => {
        this.restartLevel();
      }, 2000);
    }
  }

  /**
   * Trigger button press effect - remove all lasers and sink all buttons
   */
  private triggerButtonPress(): void {
    // Immediately destroy all lasers
    for (const laser of this.lasers) {
      laser.destroy(this.physicsWorld);
    }
    this.lasers = [];
    this.laserColliderHandles.clear();

    // Trigger sink animation for all buttons
    for (const button of this.buttons) {
      button.triggerSink(() => {
        // Remove button after sink animation completes
        button.destroy(this.physicsWorld);
        const index = this.buttons.indexOf(button);
        if (index > -1) {
          this.buttons.splice(index, 1);
        }
        // Clear collider handles for this button
        for (const handle of button.getColliderHandles()) {
          this.buttonColliderHandles.delete(handle);
        }
      });
    }
  }

  /**
   * Fixed update loop for physics
   */
  private fixedUpdate(dt: number): void {
    if (this.gameState !== GameState.PLAYING) return;

    // Apply seesaw spring forces BEFORE physics step
    for (const seesaw of this.seesaws) {
      seesaw.applyForces();
    }

    // Apply continuous conveyor forces
    for (const contact of this.activeConveyorContacts) {
      this.applyAcceleration(contact, dt);
    }

    // Step physics world
    this.physicsWorld.step(dt);

    // Process collision events
    this.processCollisions();

    // Check boundaries (using physics positions)
    this.checkBoundaries();
  }

  /**
   * Main game loop update
   */
  private update(ticker: PIXI.Ticker): void {
    const dt = ticker.deltaMS / 1000;
    this.accumulator += dt;

    // Cap accumulator to prevent spiral of death on lag
    // (e.g. if dt is huge, we don't want to run too many physics steps)
    if (this.accumulator > 0.1) {
      this.accumulator = 0.1;
    }

    while (this.accumulator >= FIXED_TIMESTEP) {
      this.fixedUpdate(FIXED_TIMESTEP);
      this.accumulator -= FIXED_TIMESTEP;

      // Stop if game over to prevent state changes after win/loss
      if (this.gameState === GameState.WON || this.gameState === GameState.LOST) {
        this.accumulator = 0;
        break;
      }
    }

    // Check boundaries check was moved to fixedUpdate

    // Update lasers (flip animation, visual only)
    for (const laser of this.lasers) {
      laser.update(dt);
    }

    // Update buttons (sink animation)
    for (const button of this.buttons) {
      button.update(dt);
    }

    // Stop updates if game is over
    if (this.gameState === GameState.WON || this.gameState === GameState.LOST) return;

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

    // Update ice blocks (handle melting and removal)
    for (let i = this.iceBlocks.length - 1; i >= 0; i--) {
      const iceBlock = this.iceBlocks[i];
      if (iceBlock.update(dt)) {
        // Ice block has fully melted
        this.iceBlockColliderHandles.delete(iceBlock.getColliderHandle());
        iceBlock.destroy(this.physicsWorld);
        this.iceBlocks.splice(i, 1);
      }
    }

    // Update seesaws graphics from physics
    for (const seesaw of this.seesaws) {
      seesaw.update();
    }

    // Update conveyors (gear animation)
    for (const conveyor of this.conveyors) {
      conveyor.update(dt);
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
   * Uses shape cast (ball shape) instead of ray cast to ensure the entire line segment
   * maintains a minimum distance from restricted areas.
   */
  private checkIntersection(p1: Point, p2: Point): Point | null {
    // 1. Check Physics World (Shape Cast)
    const world = this.physicsWorld.getWorld();
    const R = this.physicsWorld.getRAPIER();

    const physP1 = this.physicsWorld.toPhysics(p1.x, p1.y);
    const physP2 = this.physicsWorld.toPhysics(p2.x, p2.y);

    const dx = physP2.x - physP1.x;
    const dy = physP2.y - physP1.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len > 0.001) {
      const dir = { x: dx / len, y: dy / len };

      // Use a ball shape with radius equal to half of LINE_WIDTH (the line's visual radius)
      // This ensures the entire line (including its thickness) stays away from obstacles
      const shapeRadius = (LINE_WIDTH / 2) / SCALE;
      const shape = new R.Ball(shapeRadius);

      // Shape cast from p1 in direction of p2
      // API: castShape(shapePos, shapeRot, shapeVel, shape, targetDistance, maxToi, stopAtPenetration, filterFlags, filterGroups, ...)
      const targetDistance = 0.0;  // We want the first hit, not with some margin
      const maxToi = len;           // Maximum time of impact is the length of the segment
      const stopAtPenetration = true; // Stop at first contact if already penetrating

      const hit = world.castShape(
        physP1,           // shapePos: starting position
        0,                // shapeRot: rotation (0 for ball)
        dir,              // shapeVel: direction of movement (unit vector)
        shape,            // shape: the ball shape
        targetDistance,   // targetDistance: separation distance at which we consider a hit
        maxToi,           // maxToi: maximum time of impact (distance in this case)
        stopAtPenetration,// stopAtPenetration: if true, reports hit even when initially penetrating
        undefined,        // filterFlags: optional, we use filterGroups
        COLLISION_GROUP.ALL // filterGroups: collision filter groups
      );

      if (hit) {
        // hit.time_of_impact (toi) is the distance along the direction vector where the hit occurred
        // The hit point is at p1 + dir * toi
        const toi = hit.time_of_impact;
        const hitX = physP1.x + dir.x * toi;
        const hitY = physP1.y + dir.y * toi;
        const pixelHit = this.physicsWorld.toPixels(hitX, hitY);

        return pixelHit;
      }
    }

    // 2. Check Nets is now covered by the Physics World Shape Cast above
    // because Net now has a collider in the COLLISION_GROUP.NET
    // and the shape cast mask 0xFFFFFFFF includes it.

    return null;
  }

  /**
   * Helper for Line-Rect intersection
   */


  /**
   * Get the Pixi.js application
   */
  getApp(): PIXI.Application {
    return this.app;
  }
}
