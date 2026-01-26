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
import { PenSelectionUI } from './ui/PenSelectionUI';
import { EditorUI } from './ui/EditorUI';
import { TransformGizmo } from './editor/TransformGizmo';
import { ConfirmDialog } from './ui/modals/ConfirmDialog';
import { UIFactory } from './ui/UIFactory';
import { type Pen, DEFAULT_PEN } from './data/PenData';
import { DrawingManager } from './input/DrawingManager';
import { LevelManager } from './levels/LevelManager';
import { LevelService, CURRENT_USER_ID } from './services/LevelService';
import type { LevelData } from './levels/LevelSchema';
import type { Point } from './utils/douglasPeucker';
import {
  BACKGROUND_COLOR,
  GRID_SIZE,
  GRID_COLOR,
  BALL_COLORS,
  BALL_RADIUS,
  COLLISION_GROUP,
  SCALE,
  FIXED_TIMESTEP,
  calculateCanvasSize,
  setCanvasSize,
  getCanvasWidth,
  getCanvasHeight,
  getScaleFactor,
  scale,
  EDITOR_SELECTION_COLOR,
  EDITOR_SELECTION_ALPHA,
  EDITOR_OUTLINE_WIDTH_NORMAL,
  EDITOR_OUTLINE_WIDTH_FOCUSED,
  CONVEYOR_BELT_HEIGHT,
} from './config';
import { EffectManager } from './effects/EffectManager';
import { LanguageManager, type TranslationKey } from './i18n/LanguageManager';

export const GameState = {
  READY: 0,
  PLAYING: 1,
  WON: 2,
  LOST: 3,
  MENU: 4,
  EDIT: 5,
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
  private backgroundContainer: PIXI.Container;
  private menuContainer: PIXI.Container;
  private interactionArea: PIXI.Graphics;
  private hasStarted: boolean = false;
  private effectManager: EffectManager;
  private gameState: GameState = GameState.READY;
  private autoRestartTimeout: ReturnType<typeof setTimeout> | null = null;
  private accumulator: number = 0;

  private currentPen: Pen = DEFAULT_PEN;
  private penSelectionUI: PenSelectionUI | null = null;
  private levelSelectionUI: any = null; // Type will be LevelSelectionUI, using any to avoid import cycles if any
  private confirmDialog: ConfirmDialog | null = null;
  private uiLayer: PIXI.Container;
  private penBtnContainer: PIXI.Container | null = null;
  private restartBtnContainer: PIXI.Container | null = null;
  private homeBtnContainer: PIXI.Container | null = null;
  private publishBtnContainer: PIXI.Container | null = null;
  private editorUI: EditorUI | null = null;
  private editingLevel: LevelData | null = null;
  private editorHasChanged: boolean = false;
  private editorObjects: { container: PIXI.Container, data: any, type: string, lastFocused: number }[] = [];
  private selectedObject: { container: PIXI.Container, data: any, type: string } | null = null;
  private transformGizmo: TransformGizmo | null = null;
  private initialAuthorPassed: boolean = false;

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
    this.backgroundContainer = new PIXI.Container();
    this.gameContainer = new PIXI.Container();
    this.menuContainer = new PIXI.Container();
    this.menuContainer = new PIXI.Container();
    this.uiLayer = new PIXI.Container();
    this.interactionArea = new PIXI.Graphics();
    this.effectManager = new EffectManager(this.gameContainer);
  }

  /**
   * Initialize the game
   */
  async init(): Promise<void> {
    // Initialize Rapier.js WASM (must be done first)
    await this.physicsWorld.init();

    // Calculate initial canvas size based on window
    const { width, height } = calculateCanvasSize(window.innerWidth, window.innerHeight);
    setCanvasSize(width, height);

    // Initialize Pixi.js application with dynamic size
    await this.app.init({
      width: width,
      height: height,
      backgroundColor: BACKGROUND_COLOR,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // Load assets
    await PIXI.Assets.load(import.meta.env.BASE_URL + 'net.svg');
    await PIXI.Assets.load(import.meta.env.BASE_URL + 'gear.svg');
    this.laserTexture = await PIXI.Assets.load(import.meta.env.BASE_URL + 'laser.svg');

    // Preload icons font to prevent rendering issues
    await document.fonts.load('10pt "bootstrap-icons"');

    console.log('Pixi initialized, adding canvas...');
    // Add canvas to DOM
    const container = document.getElementById('app');
    if (container) {
      container.appendChild(this.app.canvas);
    } else {
      document.body.appendChild(this.app.canvas);
    }

    // Setup containers
    this.app.stage.addChild(this.backgroundContainer);
    this.app.stage.addChild(this.gameContainer);
    this.app.stage.addChild(this.menuContainer);
    this.app.stage.addChild(this.uiLayer);

    // Set uiLayer to passive so pointer events pass through to gameContainer for drawing
    // UI buttons use pointertap which still works with passive parent
    this.uiLayer.eventMode = 'passive';

    // Create background grid
    this.createBackground();

    // Create interaction area (invisible rectangle covering the canvas)
    this.updateInteractionArea();
    this.interactionArea.zIndex = 0;
    this.gameContainer.addChild(this.interactionArea);
    this.gameContainer.sortableChildren = true;

    // Setup drawing
    this.setupDrawing();
    if (this.drawingManager) {
      this.drawingManager.getContainer().zIndex = 100;
    }

    // Create UI
    this.setupCanvasUI();

    // Initialize Menu
    this.initMenu();
    this.showLevelSelection();

    // Setup resize listener
    window.addEventListener('resize', this.handleResize.bind(this));

    // Start game loop
    this.app.ticker.add(this.update.bind(this));
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    const { width, height } = calculateCanvasSize(window.innerWidth, window.innerHeight);
    setCanvasSize(width, height);

    // Resize Pixi renderer
    this.app.renderer.resize(width, height);

    // Update background
    this.backgroundContainer.removeChildren();
    this.createBackground();

    // Update interaction area
    this.updateInteractionArea();

    // Update UI layout
    this.updateUILayout();

    // Update level selection UI if visible
    if (this.levelSelectionUI) {
      this.levelSelectionUI.updateLayout();
    }

    // Update editor UI if active
    if (this.editorUI) {
      this.editorUI.updateLayout();
    }
  }

  /**
   * Update interaction area to match current canvas size
   */
  private updateInteractionArea(): void {
    this.interactionArea.clear();
    this.interactionArea.rect(0, 0, getCanvasWidth(), getCanvasHeight());
    this.interactionArea.fill({ color: 0xFFFFFF, alpha: 0 });
  }

  /**
   * Update UI layout after resize
   */
  private updateUILayout(): void {
    const btnY = scale(36);
    const btnSize = scale(52);
    const btnSpacing = scale(20);
    const fontSize = scale(60);

    // Update button positions and sizes
    if (this.homeBtnContainer) {
      this.homeBtnContainer.position.set(scale(20), btnY);
      this.updateButtonSize(this.homeBtnContainer, btnSize, fontSize);
    }

    const restartX = getCanvasWidth() - scale(20) - btnSize;
    if (this.restartBtnContainer) {
      this.restartBtnContainer.position.set(restartX, btnY);
      this.updateButtonSize(this.restartBtnContainer, btnSize, fontSize);
    }

    const penX = restartX - btnSpacing - btnSize;
    if (this.penBtnContainer) {
      this.penBtnContainer.position.set(penX, btnY);
      this.updateButtonSize(this.penBtnContainer, btnSize, fontSize);
    }

    const publishX = penX - btnSpacing - btnSize;
    if (this.publishBtnContainer) {
      this.publishBtnContainer.position.set(publishX, btnY);
      this.updateButtonSize(this.publishBtnContainer, btnSize, fontSize);
    }


  }

  /**
   * Update button size and font
   */
  private updateButtonSize(container: PIXI.Container, size: number, fontSize: number): void {
    // Update hit area
    const hitArea = container.children[0] as PIXI.Graphics;
    if (hitArea) {
      hitArea.clear();
      hitArea.rect(0, 0, size, size);
      hitArea.fill({ color: 0xFFFFFF, alpha: 0.001 });
    }

    // Update text position and size
    const text = container.children[1] as PIXI.Text;
    if (text) {
      text.style.fontSize = fontSize;
      text.position.set(size / 2, size / 2);
    }
  }



  /**
   * Load level by data
   */
  async loadLevel(data: LevelData): Promise<void> {
    await this.levelManager.loadLevelData(data);
    const levelData = this.levelManager.getCurrentLevel();

    if (!levelData) {
      console.error('Failed to load level data');
      return;
    }

    // this.currentLevelIndex is no longer the primary way we identify levels, 
    // but we might want to track ID or title for display.
    this.gameState = GameState.READY;

    // Clear existing dynamic objects
    this.clearLevel();

    // Show/Hide Publish and Edit Buttons
    if (this.publishBtnContainer) {
      const isMyDraft = levelData.authorId === CURRENT_USER_ID && levelData.isPublished === false;
      this.publishBtnContainer.visible = isMyDraft;

      // If in Editor Play Mode, hide global buttons (EditorUI handles them)
      if (isMyDraft) {
        if (this.penBtnContainer) this.penBtnContainer.visible = false;
        if (this.restartBtnContainer) this.restartBtnContainer.visible = false;
        if (this.homeBtnContainer) this.homeBtnContainer.visible = false;
      }
    }


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
      this.interactionArea.removeAllListeners();
      this.drawingManager.enable(
        this.interactionArea,
        this.onLineDrawn.bind(this),
        this.startGame.bind(this)
      );
      this.drawingManager.setCollisionProvider({
        isPointValid: (point: Point) => {
          // Unscale from visual space to design space for physics check
          // Point is already in design coordinates from DrawingManager
          const designX = point.x;
          const designY = point.y;

          // Check Nets
          // Net check is now covered by Physics World intersection check below

          // Check Physics Objects (Balls, Obstacles, Falling Objects, Lines)
          const physicsPos = this.physicsWorld.toPhysics(designX, designY);
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

    if (this.penBtnContainer) {
      this.penBtnContainer.visible = true;
    }

    if (this.editorUI) {
      this.editorUI.setPenButtonVisible(true);
    }

    if (this.publishBtnContainer) {
      // Logic managed by loadLevel/startLevel
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

    // Clear Editor Objects
    for (const obj of this.editorObjects) {
      obj.container.destroy();
    }
    this.editorObjects = [];
    this.deselectObject();

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
      this.startGame.bind(this),
      this.onDrawingStart.bind(this)
    );
  }

  /**
   * Handle when drawing starts (pointer down)
   */
  private onDrawingStart(): void {
    // Hide Pen Button immediately when player starts drawing
    if (this.penBtnContainer) {
      this.penBtnContainer.visible = false;
    }

    // Also hide Editor Pen Button if in use
    if (this.editorUI) {
      this.editorUI.setPenButtonVisible(false);
    }
  }

  /**
   * Start the game simulation
   */
  private startGame(): void {
    if (!this.hasStarted) {
      this.hasStarted = true;
      this.gameState = GameState.PLAYING;
      // Update game objects
      const scaleFactor = getScaleFactor();
      this.balls.forEach(ball => ball.update(scaleFactor));
      this.drawnLines.forEach(line => line.update(scaleFactor));
      this.fallingObjects.forEach(obj => obj.update(scaleFactor));
      this.seesaws.forEach(seesaw => seesaw.update(scaleFactor));
      this.conveyors.forEach(conveyor => conveyor.update(scaleFactor));
      this.buttons.forEach(btn => btn.update(scaleFactor));
      this.nets.forEach(net => net.update(scaleFactor));
      this.iceBlocks.forEach(ice => ice.update(scaleFactor));
      this.lasers.forEach(laser => laser.update(scaleFactor));
      this.balls.forEach(ball => ball.activate());
      this.fallingObjects.forEach(obj => obj.activate());

      if (this.penBtnContainer) {
        this.penBtnContainer.visible = false;
      }
      if (this.publishBtnContainer) {
        this.publishBtnContainer.visible = false;
      }
      if (this.editorUI) {
        this.editorUI.setPenButtonVisible(false);
      }
    }
  }

  /**
   * Handle when a line is drawn
   */
  private onLineDrawn(points: Point[]): void {
    if (this.gameState !== GameState.READY && this.gameState !== GameState.PLAYING) return;

    const line = new DrawnLine(this.physicsWorld, points, this.currentPen);
    this.drawnLines.push(line);
    this.gameContainer.addChild(line.graphics);
    line.update(); // Initial position update with scaling

    // Register all colliders for conveyor detection
    for (const collider of line.colliders) {
      this.drawnLineColliderHandles.set(collider.handle, line);
    }

    // Start game if not started (redundant with onDrawingEnd but safe)
    this.startGame();
  }

  /**
   * Create UI overlay on Canvas
   */
  private setupCanvasUI(): void {
    const btnY = scale(36);
    const btnSize = scale(52);
    const btnSpacing = scale(20);

    // Home Button (Top Left)
    this.homeBtnContainer = UIFactory.createTopBarButton('\uF284', () => {
      this.showLevelSelection();
    });
    this.homeBtnContainer.position.set(scale(20), btnY);
    this.uiLayer.addChild(this.homeBtnContainer);

    // Restart Button (Top Right)
    const restartX = getCanvasWidth() - scale(20) - btnSize;
    this.restartBtnContainer = UIFactory.createTopBarButton('\uF116', () => {
      this.restartLevel();
    });
    this.restartBtnContainer.position.set(restartX, btnY);
    this.uiLayer.addChild(this.restartBtnContainer);

    // Pen Button (Left of Restart)
    const penX = restartX - btnSpacing - btnSize;
    this.penBtnContainer = UIFactory.createTopBarButton('\uF604', () => {
      this.showPenSelection();
    });
    this.penBtnContainer.position.set(penX, btnY);
    this.uiLayer.addChild(this.penBtnContainer);

    // Publish Button (Left of Pen) - Cloud Arrow Up
    const publishX = penX - btnSpacing - btnSize;
    this.publishBtnContainer = UIFactory.createTopBarButton('\uF297', async () => {
      const currentLevel = this.levelManager.getCurrentLevel();
      if (!currentLevel) return;

      if (!currentLevel.authorPassed) {
        this.showConfirmDialog(
          LanguageManager.getInstance().t('publish.confirm_clear'),
          () => this.closeConfirmDialog(),
          () => this.closeConfirmDialog(),
          { showCancel: false, confirmKey: 'common.ok' }
        );
        return;
      }

      this.showConfirmDialog(
        LanguageManager.getInstance().t('publish.confirm_publish'),
        async () => {
          this.closeConfirmDialog();
          // Auto-save current design first, especially if they just passed
          await this.saveLevel();
          await LevelService.getInstance().publishLevel(currentLevel.id);
          currentLevel.isPublished = true;

          this.showConfirmDialog(
            LanguageManager.getInstance().t('publish.success'),
            () => {
              this.closeConfirmDialog();
              this.showLevelSelection();
            },
            () => {
              this.closeConfirmDialog();
              this.showLevelSelection();
            },
            { showCancel: false, confirmKey: 'common.ok' }
          );
        },
        () => this.closeConfirmDialog()
      );
    });
    this.publishBtnContainer.position.set(publishX, btnY);
    this.publishBtnContainer.visible = false; // Default hidden
    this.uiLayer.addChild(this.publishBtnContainer);
  }



  /**
   * Show Pen Selection UI
   */
  private showPenSelection(): void {
    if (this.penSelectionUI) {
      this.gameContainer.removeChild(this.penSelectionUI);
      this.penSelectionUI.destroy();
      this.penSelectionUI = null;
    }

    this.penSelectionUI = new PenSelectionUI(
      (pen) => {
        this.currentPen = pen;
        if (this.drawingManager) {
          this.drawingManager.setPen(pen);
        }
        this.closePenSelection();
      },
      () => {
        // If closed without selection, maybe keep default?
        // Or insist on selection? User said "Choose a pen", implies mandatory or default.
        // Let's assume closing uses current default.
        this.closePenSelection();
      },
      this.currentPen.id
    );

    this.penSelectionUI.zIndex = 200; // Above everything
    this.gameContainer.addChild(this.penSelectionUI);
  }

  private closePenSelection(): void {
    if (this.penSelectionUI) {
      this.gameContainer.removeChild(this.penSelectionUI);
      this.penSelectionUI.destroy();
      this.penSelectionUI = null;
    }
  }

  /**
   * Restart the current level
   */
  private async restartLevel(): Promise<void> {
    const current = this.levelManager.getCurrentLevel();
    if (current) {
      await this.loadLevel(current);
    }
  }

  /**
   * Process collision events from Rapier
   */
  private processCollisions(): void {
    if (this.gameState !== GameState.PLAYING && this.gameState !== GameState.READY) return;

    const eventQueue = this.physicsWorld.getEventQueue();

    eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      if (started) {
        const ball1 = this.ballColliderHandles.get(handle1);
        const ball2 = this.ballColliderHandles.get(handle2);

        // Check if both colliders are balls (blue and pink)
        if (ball1 && ball2 && this.gameState === GameState.PLAYING) {
          // Get positions for effect
          const pos1 = ball1.body.translation();
          const pos2 = ball2.body.translation();
          const midX = (pos1.x + pos2.x) / 2;
          const midY = (pos1.y + pos2.y) / 2;

          const pixelPos = this.physicsWorld.toPixels(midX, midY);
          const scaleFactor = getScaleFactor();
          this.handleWin(pixelPos.x * scaleFactor, pixelPos.y * scaleFactor);
        }

        // Check for ice block collisions
        const iceBlock1 = this.iceBlockColliderHandles.get(handle1);
        const iceBlock2 = this.iceBlockColliderHandles.get(handle2);

        // If one of the colliders is an ice block, start melting it
        if (iceBlock1 && !iceBlock1.getIsMelting() && this.gameState === GameState.PLAYING) {
          iceBlock1.startMelting();
        }
        if (iceBlock2 && !iceBlock2.getIsMelting() && this.gameState === GameState.PLAYING) {
          iceBlock2.startMelting();
        }

        // Check for laser collisions with balls
        const laser1 = this.laserColliderHandles.get(handle1);
        const laser2 = this.laserColliderHandles.get(handle2);
        const ballHitByLaser = (laser1 && ball2) || (laser2 && ball1);

        if (ballHitByLaser && this.gameState === GameState.PLAYING) {
          const hitBall = ball1 || ball2;
          if (hitBall) {
            this.handleLoss(hitBall);
          }
        }

        // Check for button collisions with balls
        const button1 = this.buttonColliderHandles.get(handle1);
        const button2 = this.buttonColliderHandles.get(handle2);
        const ballHitButton = (button1 && ball2) || (button2 && ball1);

        if (ballHitButton && this.gameState === GameState.PLAYING) {
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
    const margin = scale(BALL_RADIUS * 2);
    const bounds = {
      minX: -margin,
      maxX: getCanvasWidth() + margin,
      maxY: getCanvasHeight() + margin
    };

    const scaleFactor = getScaleFactor();
    for (const ball of this.balls) {
      const pos = ball.body.translation();
      const pixelPos = this.physicsWorld.toPixels(pos.x, pos.y);
      // Convert to screen coordinates for boundary check
      const x = pixelPos.x * scaleFactor;
      const y = pixelPos.y * scaleFactor;

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

    const clampedX = Math.max(0, Math.min(x, getCanvasWidth()));
    const clampedY = Math.max(0, Math.min(y, getCanvasHeight()));

    // Trigger effects immediately for visual responsiveness
    this.effectManager.createRingExplosion(clampedX, clampedY, 0xFFD700, 1);
    this.effectManager.createParticleExplosion(clampedX, clampedY, 0xFFD700, 'star');

    // Update state locally if it's an author test play and they passed for first time
    const currentLevel = this.levelManager.getCurrentLevel();
    if (currentLevel && currentLevel.authorId === CURRENT_USER_ID) {
      if (!currentLevel.authorPassed) {
        currentLevel.authorPassed = true;
      }
    }

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
    const scaleFactor = getScaleFactor();
    const color = BALL_COLORS[ball.type];

    // Scale position to screen coordinates
    const screenX = pixelPos.x * scaleFactor;
    const screenY = pixelPos.y * scaleFactor;

    // Remove ball
    ball.destroy(this.physicsWorld);
    const index = this.balls.indexOf(ball);
    if (index > -1) this.balls.splice(index, 1);
    this.ballColliderHandles.delete(ball.getColliderHandle());

    // Also remove from active conveyor contacts
    this.activeConveyorContacts = this.activeConveyorContacts.filter(c => c.body !== ball.body);


    // Calculate clamped position for effects (so they are visible if ball is out of bounds)
    const clampedX = Math.max(0, Math.min(screenX, getCanvasWidth()));
    const clampedY = Math.max(0, Math.min(screenY, getCanvasHeight()));

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
    if (this.gameState !== GameState.PLAYING && this.gameState !== GameState.READY) return;

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

    const scaleFactor = getScaleFactor();

    // Update ALL game objects for responsive rendering and animations

    // Lasers (flip animation)
    for (const laser of this.lasers) {
      laser.update(scaleFactor, dt);
    }

    // Buttons (sink animation)
    for (const button of this.buttons) {
      button.update(scaleFactor, dt);
    }

    // Balls from physics
    for (const ball of this.balls) {
      ball.update(scaleFactor);
    }

    // Falling objects from physics
    for (const obj of this.fallingObjects) {
      obj.update(scaleFactor);
    }

    // Drawn lines from physics (update and check out-of-bounds)
    const drawnLineBoundary = getCanvasHeight() + getCanvasHeight() * 0.5;
    for (let i = this.drawnLines.length - 1; i >= 0; i--) {
      const line = this.drawnLines[i];
      line.update(scaleFactor);

      // Check if line's center of mass is below screen bottom by more than half screen height
      const pos = line.body.translation();
      const pixelY = this.physicsWorld.toPixels(pos.x, pos.y).y * scaleFactor;
      if (pixelY > drawnLineBoundary) {
        // Remove from collider handles
        for (const collider of line.colliders) {
          this.drawnLineColliderHandles.delete(collider.handle);
        }
        // Remove from active conveyor contacts
        this.activeConveyorContacts = this.activeConveyorContacts.filter(c => c.body !== line.body);
        // Destroy the line
        line.destroy(this.physicsWorld);
        this.drawnLines.splice(i, 1);
      }
    }

    // Ice blocks (melting and removal)
    for (let i = this.iceBlocks.length - 1; i >= 0; i--) {
      const iceBlock = this.iceBlocks[i];
      if (iceBlock.update(scaleFactor, dt)) {
        this.iceBlockColliderHandles.delete(iceBlock.getColliderHandle());
        iceBlock.destroy(this.physicsWorld);
        this.iceBlocks.splice(i, 1);
      }
    }

    // Seesaws from physics
    for (const seesaw of this.seesaws) {
      seesaw.update(scaleFactor);
    }

    // Conveyor Belts (gear animation)
    for (const conveyor of this.conveyors) {
      conveyor.update(scaleFactor, dt);
    }

    // Obstacles and Nets (responsive positioning)
    for (const obstacle of this.obstacles) {
      obstacle.update(scaleFactor);
    }
    for (const net of this.nets) {
      net.update(scaleFactor);
    }
  }

  /**
   * Create the background grid
   */
  private createBackground(): void {
    const gridGraphics = new PIXI.Graphics();
    const width = getCanvasWidth();
    const height = getCanvasHeight();
    const gridSize = scale(GRID_SIZE);

    const startX = (width / 2) % gridSize;
    const startY = (height / 2) % gridSize;

    for (let x = startX; x <= width; x += gridSize) {
      gridGraphics.moveTo(x, 0);
      gridGraphics.lineTo(x, height);
    }

    for (let y = startY; y <= height; y += gridSize) {
      gridGraphics.moveTo(0, y);
      gridGraphics.lineTo(width, y);
    }

    gridGraphics.stroke({ width: 1, color: GRID_COLOR });

    if (this.backgroundContainer) {
      this.backgroundContainer.addChild(gridGraphics);
    } else {
      this.gameContainer.addChildAt(gridGraphics, 0);
    }
  }

  private async initMenu(): Promise<void> {
    // Dynamic import to avoid circular dependencies if any
    const { LevelSelectionUI } = await import('./ui/LevelSelectionUI');

    // Fetch all levels (built-in + user uploaded) from Service
    const levelService = LevelService.getInstance();
    const levels = await levelService.getLevelList();

    this.levelSelectionUI = new LevelSelectionUI(levels, (levelData) => {
      // Create a deep clone of the level data to work on.
      // This ensures that any in-memory modifications (status or content) during the session
      // do not leak back to the UI source or Service cache if the user chooses to Discard.
      const levelClone = JSON.parse(JSON.stringify(levelData));

      if (levelData.authorId === CURRENT_USER_ID && !levelData.isPublished) {
        console.log('Entering Edit Mode for level:', levelClone.id);
        this.startLevel(levelClone);
        // TODO: Switch to GameState.EDIT fully when EditorUI is ready
        // this.gameState = GameState.EDIT;
      } else {
        this.startLevel(levelClone);
      }
    }, () => {
      this.createNewLevel();
    }, this.laserTexture || undefined, (pen) => {
      this.currentPen = pen;
      if (this.drawingManager) {
        this.drawingManager.setPen(pen);
      }
    }, this.currentPen.id);
    this.menuContainer.addChild(this.levelSelectionUI);
  }

  private async showLevelSelection(): Promise<void> {
    this.gameState = GameState.MENU;
    // Clear editing session
    this.editingLevel = null;
    this.editorHasChanged = false;
    if (this.editorUI) {
      this.editorUI.visible = false;
      this.editorUI.destroy(); // Destroy it to reset state? Or keep?
      // Destroying is safer to reset tools/toggles completely.
      this.uiLayer.removeChild(this.editorUI);
      this.editorUI = null;
    }

    if (this.levelSelectionUI) {
      this.levelSelectionUI.setPen(this.currentPen.id);

      // Refresh Levels
      const levelService = LevelService.getInstance();
      const levels = await levelService.getLevelList();
      this.levelSelectionUI.updateLevels(levels);
    }
    this.clearLevel();
    this.gameContainer.visible = false;
    this.menuContainer.visible = true;

    if (this.penBtnContainer) this.penBtnContainer.visible = false;
    if (this.restartBtnContainer) this.restartBtnContainer.visible = false;
    if (this.homeBtnContainer) this.homeBtnContainer.visible = false;
    if (this.publishBtnContainer) this.publishBtnContainer.visible = false;
  }

  private async startLevel(levelData: LevelData): Promise<void> {
    this.menuContainer.visible = false;
    this.gameContainer.visible = true;
    this.gameState = GameState.READY; // Will switch to PLAYING on interaction

    await this.loadLevel(levelData);

    if (this.editorUI) {
      this.editorUI.visible = false;
    }

    // If this is the author's unpublished level, ensure Editor UI (Toggle) is visible
    if (levelData.authorId === CURRENT_USER_ID && !levelData.isPublished) {
      if (!this.editorUI) {
        // Initialize Editor UI if not exists
        this.editorUI = new EditorUI(
          () => this.handleEditorClose(),
          (mode) => this.toggleEditorMode(mode),
          (type, subType, initialEventData) => this.addObject(type, subType, initialEventData),
          () => this.copySelectedObject(),
          () => this.deleteSelectedObject(),
          () => this.restartLevel(),
          () => this.showPenSelection(),
          (obj) => this.selectObject(obj.container, obj.data, obj.type),
          () => this.editorObjects,
          (obj) => this.updateEditorObject(obj)
        );
        this.uiLayer.addChild(this.editorUI);
      }

      // Ensure visibility and correct state (Play Mode)
      this.editorUI.visible = true;
      this.editorUI.setUIState('play');
      this.editingLevel = levelData; // Track editing level so toggle works

      // Initialize tracking for "Untested -> Draft" status update
      this.initialAuthorPassed = levelData.authorPassed || false;

    } else {
      if (this.editorUI) {
        this.editorUI.visible = false;
      }
    }

    const isEditorPlay = levelData.authorId === CURRENT_USER_ID && !levelData.isPublished;
    if (isEditorPlay) {
      if (this.penBtnContainer) this.penBtnContainer.visible = false;
      if (this.restartBtnContainer) this.restartBtnContainer.visible = false;
      if (this.homeBtnContainer) this.homeBtnContainer.visible = false;
    } else {
      if (this.penBtnContainer) this.penBtnContainer.visible = true;
      if (this.restartBtnContainer) this.restartBtnContainer.visible = true;
      if (this.homeBtnContainer) this.homeBtnContainer.visible = true;
    }
    // publishBtnContainer visibility is controlled in loadLevel based on level data
  }

  /**
   * Show a confirm dialog on canvas
   */
  private showConfirmDialog(
    message: string,
    onConfirm: () => void,
    onCancel: () => void,
    options?: { confirmText?: string; cancelText?: string; confirmKey?: TranslationKey; cancelKey?: TranslationKey; showCancel?: boolean; onDismiss?: () => void }
  ): void {
    this.closeConfirmDialog();
    this.confirmDialog = new ConfirmDialog(message, onConfirm, onCancel, options);
    this.uiLayer.addChild(this.confirmDialog);
  }

  /**
   * Close the confirm dialog
   */
  private closeConfirmDialog(): void {
    if (this.confirmDialog) {
      this.uiLayer.removeChild(this.confirmDialog);
      this.confirmDialog.destroy();
      this.confirmDialog = null;
    }
  }

  /**
   * Check intersection for drawing
   * Uses shape cast (ball shape) instead of ray cast to ensure the entire line segment
   * maintains a minimum distance from restricted areas.
   */
  /**
   * Check intersection for drawing
   * Uses multiple ray casts instead of shape cast to avoid precision issues
   */
  private checkIntersection(p1: Point, p2: Point): Point | null {
    // 1. Check Physics World (Ray Casts)
    const world = this.physicsWorld.getWorld();
    const R = this.physicsWorld.getRAPIER();

    const physP1 = this.physicsWorld.toPhysics(p1.x, p1.y);
    const physP2 = this.physicsWorld.toPhysics(p2.x, p2.y);

    const dx = physP2.x - physP1.x;
    const dy = physP2.y - physP1.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len > 0.001) {
      const dir = { x: dx / len, y: dy / len };

      // Calculate perpendicular offset for thickness check
      // Use half width to check the edges of the line
      const radius = (this.currentPen.width / 2) / SCALE;
      const orthoX = -dir.y * radius;
      const orthoY = dir.x * radius;

      // Define rays to cast across the width to simulate thickness
      // We cast multiple rays distributed across the width of the line to prevent leakage
      const numRays = 7;
      const rays = [];

      for (let i = 0; i < numRays; i++) {
        // Calculate offset factor from -1 to 1
        // i=0 -> -1 (Left Edge)
        // i=mid -> 0 (Center)
        // i=max -> 1 (Right Edge)
        const t = i / (numRays - 1);
        const offset = (t - 0.5) * 2;

        rays.push(new R.Ray({
          x: physP1.x + orthoX * offset,
          y: physP1.y + orthoY * offset
        }, dir));
      }

      let minToi = len;
      let hasHit = false;

      for (const ray of rays) {
        const hit = world.castRay(
          ray,
          len,
          true,
          undefined,
          COLLISION_GROUP.ALL
        );

        if (hit) {
          if (hit.timeOfImpact < minToi) {
            minToi = hit.timeOfImpact;
            hasHit = true;
          }
        }
      }

      // Additional Tip Clearance Check
      // We want to find the furthest point along the calculated path (up to minToi)
      // such that a larger 'tip' shape centered at that point DOES NOT collide with anything.
      const TIP_DIAMETER_EXTRA_PX = 1;
      const tipRadius = ((this.currentPen.width + TIP_DIAMETER_EXTRA_PX) / 2) / SCALE;
      const tipShape = new R.Ball(tipRadius);

      // Helper to check validity at distance t
      const checkIsValid = (t: number): boolean => {
        const testX = physP1.x + dir.x * t;
        const testY = physP1.y + dir.y * t;

        // intersectionWithShape returns a Collider if overlapping, null otherwise
        const hit = world.intersectionWithShape(
          { x: testX, y: testY },
          0,
          tipShape,
          undefined,
          COLLISION_GROUP.ALL
        );
        return !hit;
      };

      // 1. Check if the furthest possible point (determined by rays) is valid.
      if (checkIsValid(minToi)) {
        if (hasHit) {
          const hitX = physP1.x + dir.x * minToi;
          const hitY = physP1.y + dir.y * minToi;
          // If ray hit, we respect it
          return this.physicsWorld.toPixels(hitX, hitY);
        }
        // If not hit by rays and tip is valid at end, we return null (no intersection within segment)
        // BUT wait, checkIntersection returns "Point | null".
        // If we return null, it means "no collision", so the line is drawn fully to p2.
        // This is what we want if p2 is valid.
        return null;
      } else {
        // 2. The physical limit is invalid (too close to wall for the thick tip).
        // We linear scan backwards from minToi to find the first valid point.
        // User explicitly warned against binary search because the validity is not guaranteed to be monotonic.
        // "Find an endpoint as far as possible... only endpoint needs check"

        const STEP_PX = 4; // Check every 4 pixels backwards
        const stepPhys = STEP_PX / SCALE;

        // We already checked minToi (it failed). Start backing up.
        let t = minToi - stepPhys;

        while (t > 0) {
          if (checkIsValid(t)) {
            // Found a valid spot!
            const hitX = physP1.x + dir.x * t;
            const hitY = physP1.y + dir.y * t;
            return this.physicsWorld.toPixels(hitX, hitY);
          }
          t -= stepPhys;
        }

        // If we backed up all the way to 0 and found nothing valid,
        // we essentially can't draw anything valid from this start point in this direction.
        // Return p1 to stop drawing.
        const hitX = physP1.x;
        const hitY = physP1.y;
        return this.physicsWorld.toPixels(hitX, hitY);
      }

      // If we are here, logic flow is a bit split above.
      // logic:
      // if valid(minToi):
      //    if hasHit -> return point(minToi)
      //    else -> return null (allow full line)
      // else:
      //    scan back, return point(validT) or point(0)

      // The original code returned point(minToi) if hasHit at the end.
      // Our logic above handles returns. 
      // checkIntersection implicitly returns null if "no collision" (i.e. draw user's full line).
      // So if (checkIsValid(minToi) && !hasHit) return null; covers it.

    }

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

  private async createNewLevel(): Promise<void> {
    // Create default level data
    const newLevel: LevelData = {
      id: `custom_${Date.now()}`,
      author: 'Me',
      authorId: CURRENT_USER_ID,
      createdAt: Date.now(),
      likes: 0,
      isPublished: false,
      authorPassed: false,
      balls: {
        blue: { x: 360, y: 250 },
        pink: { x: 920, y: 250 }
      },
      obstacles: []
    };

    console.log('Creating new level:', newLevel);
    await LevelService.getInstance().saveLocalDraft(newLevel);

    // Start in Edit mode (currently just Play mode as placeholder until EditorUI is ready)
    // await this.startLevel(newLevel); // Original line
    this.startEditor(newLevel);

    // TODO: Switch to GameState.EDIT once implemented
    // this.gameState = GameState.EDIT;
  }

  private startEditor(levelData: LevelData, isNewSession: boolean = true): void {
    console.log('Starting Editor for:', levelData.id);
    this.gameState = GameState.EDIT;
    this.editingLevel = levelData;
    if (isNewSession) {
      this.editorHasChanged = false;
      this.initialAuthorPassed = levelData.authorPassed || false;
    }

    // Clear everything
    this.clearLevel(); // This clears physics bodies and gameContainer children
    this.gameContainer.visible = true;
    this.menuContainer.visible = false;

    // Reset Selection
    this.deselectObject();

    // Disable Gameplay interactions
    if (this.drawingManager) {
      this.drawingManager.disable(this.interactionArea);
    }

    // Enable background interaction in editor mode
    // Click: Deselect
    // Drag: Move currently selected object
    this.interactionArea.eventMode = 'static';
    this.interactionArea.removeAllListeners();
    this.interactionArea.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      // If no object selected, just ensure clean state
      if (!this.selectedObject) {
        this.deselectObject();
        return;
      }

      const startX = e.global.x;
      const startY = e.global.y;
      let hasMoved = false;

      const onMove = (moveEvent: PIXI.FederatedPointerEvent) => {
        const dx = moveEvent.global.x - startX;
        const dy = moveEvent.global.y - startY;

        // Threshold to distinguish click from drag
        if (Math.hypot(dx, dy) > scale(10)) {
          hasMoved = true;

          if (this.transformGizmo) {
            // Handover control to gizmo using the original event to preserve start point
            this.transformGizmo.startMoveFromExternal(e);
          }

          cleanup();
        }
      };

      const onUp = () => {
        cleanup();
        if (!hasMoved) {
          this.deselectObject();
        }
      };

      const cleanup = () => {
        this.interactionArea.off('globalpointermove', onMove);
        this.interactionArea.off('pointerup', onUp);
        this.interactionArea.off('pointerupoutside', onUp);
      };

      this.interactionArea.on('globalpointermove', onMove);
      this.interactionArea.on('pointerup', onUp);
      this.interactionArea.on('pointerupoutside', onUp);
    });

    // Hide Play UI
    if (this.penBtnContainer) this.penBtnContainer.visible = false;
    if (this.restartBtnContainer) this.restartBtnContainer.visible = false;
    if (this.homeBtnContainer) this.homeBtnContainer.visible = false;
    if (this.publishBtnContainer) this.publishBtnContainer.visible = false;


    // Load Editor Level (Visuals)
    this.loadEditorLevel(levelData);

    // Create Transform Gizmo
    if (this.transformGizmo) {
      this.gameContainer.removeChild(this.transformGizmo);
      this.transformGizmo.destroy();
    }
    this.transformGizmo = new TransformGizmo();
    this.transformGizmo.zIndex = 1000; // Above all objects
    this.gameContainer.addChild(this.transformGizmo);

    // Show Editor UI
    if (isNewSession) {
      // Only rebuild EditorUI for new editing sessions
      if (this.editorUI) {
        this.uiLayer.removeChild(this.editorUI);
        this.editorUI.destroy();
        this.editorUI = null;
      }

      this.editorUI = new EditorUI(
        () => this.handleEditorClose(), // On Close
        (mode) => this.toggleEditorMode(mode),     // On Mode Toggle
        (type, subType, initialEventData) => this.addObject(type, subType, initialEventData),   // On Add Object
        () => this.copySelectedObject(), // On Copy
        () => this.deleteSelectedObject(), // On Delete
        () => this.restartLevel(), // On Restart
        () => this.showPenSelection(), // On Pen
        (obj) => this.selectObject(obj.container, obj.data, obj.type),
        () => this.editorObjects,
        (obj) => this.updateEditorObject(obj)
      );
      this.uiLayer.addChild(this.editorUI);
    }

    // Always ensure EditorUI is in edit state
    if (this.editorUI) {
      this.editorUI.setUIState('edit');
    }
  }

  private toggleEditorMode = (mode: 'edit' | 'play') => {
    if (mode === 'play') {
      this.toggleTestPlay();
    } else {
      // Switch back to edit is handled by startEditor usually, but here we might just need to update UI state
      // if we are in 'play' mode (Test Play).
      // However, toggleTestPlay calls startLevel which hides EditorUI?
      // We need to fix that interaction.
      this.stopTestPlay();
    }
  }

  private async stopTestPlay() {
    // Switch back to Edit Mode
    if (this.editingLevel) {
      this.startEditor(this.editingLevel, false);
    }
  }

  private loadEditorLevel(data: LevelData): void {
    this.editorObjects = [];

    // Balls (Editable)
    const blue = Ball.createVisual(0, 0, 'blue');
    this.setupEditorObject(blue, data.balls.blue, 'ball_blue');

    const pink = Ball.createVisual(0, 0, 'pink');
    this.setupEditorObject(pink, data.balls.pink, 'ball_pink');

    // Obstacles
    data.obstacles.forEach(obs => {
      const vis = Obstacle.createVisual(obs);
      this.setupEditorObject(vis, obs, 'obstacle');
    });

    // Falling Objects
    if (data.fallingObjects) {
      data.fallingObjects.forEach(obj => {
        const vis = FallingObject.createVisual(obj);
        this.setupEditorObject(vis, obj, 'falling');
      });
    }

    // Nets
    if (data.nets) {
      data.nets.forEach(net => {
        const vis = Net.createVisual(net);
        this.setupEditorObject(vis, net, 'net');
      });
    }

    // Ice Blocks
    if (data.iceBlocks) {
      data.iceBlocks.forEach(ice => {
        const vis = IceBlock.createVisual(ice);
        this.setupEditorObject(vis, ice, 'ice');
      });
    }

    // Lasers
    if (data.lasers && this.laserTexture) {
      data.lasers.forEach(laser => {
        const vis = Laser.createVisual(laser, this.laserTexture!, 14);
        this.setupEditorObject(vis, laser, 'laser');
      });
    }

    // Seesaws
    if (data.seesaws) {
      data.seesaws.forEach(seesaw => {
        const vis = Seesaw.createVisual(seesaw);
        this.setupEditorObject(vis, seesaw, 'seesaw');
      });
    }

    // Conveyor Belts
    if (data.conveyors) {
      data.conveyors.forEach(conveyor => {
        const vis = ConveyorBelt.createVisual(conveyor);
        this.setupEditorObject(vis, conveyor, 'conveyor');
      });
    }

    // Buttons
    if (data.buttons) {
      data.buttons.forEach(button => {
        const vis = Button.createVisual(button);
        this.setupEditorObject(vis, button, 'button');
      });
    }
  }

  private markAsEdited() {
    this.editorHasChanged = true;
    if (this.editingLevel) {
      this.editingLevel.authorPassed = false;
    }
  }

  private selectObject(container: PIXI.Container, data: any, type: string) {
    // Deselect previous (re-enable its event mode)
    if (this.selectedObject) {
      this.selectedObject.container.eventMode = 'static';
      this.updateEditorOutline(this.selectedObject.container, this.selectedObject.type, this.selectedObject.data, EDITOR_OUTLINE_WIDTH_NORMAL, EDITOR_SELECTION_COLOR);
    }

    this.selectedObject = { container, data, type };

    // Update lastFocused
    const editorObj = this.editorObjects.find(o => o.container === container);
    if (editorObj) {
      editorObj.lastFocused = Date.now();
    }

    // Disable the selected object's event mode so gizmo receives events
    container.eventMode = 'none';

    // Create visual feedback (Thick outline)
    this.updateEditorOutline(container, type, data, EDITOR_OUTLINE_WIDTH_FOCUSED, EDITOR_SELECTION_COLOR);

    // Attach TransformGizmo
    if (this.transformGizmo) {
      this.transformGizmo.setTarget(
        container,
        data,
        type,
        () => this.onGizmoTransformChange(),

        () => this.onGizmoTransformEnd(),
        () => this.deselectObject(),
        () => this.editorUI?.setGlassMode(true),
        () => this.editorUI?.setGlassMode(false)
      );
    }

    // Update Editor UI
    if (this.editorUI) {
      const isBall = type === 'ball_blue' || type === 'ball_pink';
      this.editorUI.updateTools(true, isBall);

      // Notify Property Inspector
      if (editorObj) {
        this.editorUI.setSelectedObject(editorObj);
      }
    }
  }

  private deselectObject() {
    if (this.selectedObject) {
      // Re-enable event mode for the previously selected object
      this.selectedObject.container.eventMode = 'static';
      this.updateEditorOutline(this.selectedObject.container, this.selectedObject.type, this.selectedObject.data, EDITOR_OUTLINE_WIDTH_NORMAL, EDITOR_SELECTION_COLOR);
    }
    this.selectedObject = null;

    // Clear TransformGizmo
    if (this.transformGizmo) {
      this.transformGizmo.clearTarget();
    }

    if (this.editorUI) {
      this.editorUI.updateTools(false, false);
    }
  }

  /**
   * Called during gizmo transform (live updates)
   */
  private onGizmoTransformChange(): void {
    if (!this.selectedObject) return;

    const { container, data, type } = this.selectedObject;

    // Update visual to match data changes
    this.rebuildObjectVisual(container, data, type);

    // Update outline to match new shape
    this.updateEditorOutline(container, type, data, EDITOR_OUTLINE_WIDTH_FOCUSED, EDITOR_SELECTION_COLOR);

    // Sync changes to UI
    if (this.editorUI) {
      this.editorUI.refreshPropertyInspector();
    }
  }

  /**
   * Called when gizmo transform ends (drag release)
   */
  private onGizmoTransformEnd(): void {
    this.markAsEdited();
  }

  /**
   * Rebuild the visual representation of an object after transform changes
   */
  private updateEditorObject(editorObj: { container: PIXI.Container, data: any, type: string }): void {
    const { container, data, type } = editorObj;
    this.rebuildObjectVisual(container, data, type);
    this.updateEditorOutline(container, type, data, EDITOR_OUTLINE_WIDTH_FOCUSED, EDITOR_SELECTION_COLOR);

    // Update Gizmo if this object is selected
    if (this.transformGizmo && this.selectedObject && this.selectedObject.container === container) {
      this.transformGizmo.updateGizmo();
    }

    this.markAsEdited();
  }

  private rebuildObjectVisual(container: PIXI.Container, data: any, type: string): void {
    const scaleFactor = getScaleFactor();

    // Clear existing children except outline
    const outline = container.getChildByName('__editor_outline__');
    container.removeChildren();

    // If container is a Graphics object, clear its drawing context too
    if (container instanceof PIXI.Graphics) {
      container.clear();
    }

    // Rebuild based on type
    let newVisual: PIXI.Container | PIXI.Graphics | null = null;

    switch (type) {
      case 'ball_blue':
        newVisual = Ball.createVisual(0, 0, 'blue');
        break;
      case 'ball_pink':
        newVisual = Ball.createVisual(0, 0, 'pink');
        break;
      case 'obstacle':
        newVisual = Obstacle.createVisual(data);
        break;
      case 'falling':
        newVisual = FallingObject.createVisual(data);
        break;
      case 'net':
        newVisual = Net.createVisual(data);
        break;
      case 'ice':
        newVisual = IceBlock.createVisual(data);
        break;
      case 'seesaw':
        newVisual = Seesaw.createVisual(data);
        break;
      case 'conveyor':
        newVisual = ConveyorBelt.createVisual(data);
        break;
      case 'button':
        newVisual = Button.createVisual(data);
        break;
      case 'laser':
        if (this.laserTexture) {
          newVisual = Laser.createVisual(data, this.laserTexture, 14);
        }
        break;
    }

    if (newVisual) {
      // Reset the new visual's position/rotation since container handles that
      newVisual.position.set(0, 0);
      newVisual.rotation = 0;
      newVisual.scale.set(1);

      // If newVisual has children (like Net, Seesaw, Laser), add them directly
      // Otherwise add the newVisual itself (like Graphics objects)
      if (newVisual.children.length > 0) {
        while (newVisual.children.length > 0) {
          const child = newVisual.children[0];
          newVisual.removeChild(child);
          container.addChild(child);
        }
        newVisual.destroy();
      } else {
        // It's a Graphics object - add it directly
        container.addChild(newVisual);
      }

      // Update container position/rotation from data
      if (type === 'laser') {
        const cx = (data.x1 + data.x2) / 2;
        const cy = (data.y1 + data.y2) / 2;
        container.position.set(cx * scaleFactor, cy * scaleFactor);
        container.rotation = Math.atan2(data.y2 - data.y1, data.x2 - data.x1);
      } else {
        container.position.set(data.x * scaleFactor, data.y * scaleFactor);
        if (data.angle !== undefined) {
          container.rotation = (data.angle * Math.PI) / 180;
        }
      }
      container.scale.set(scaleFactor);
    }

    // Re-add outline on top
    if (outline) {
      container.addChild(outline);
    }
  }

  private updateEditorOutline(visual: PIXI.Container, type: string, data: any, thickness: number, color: number) {
    let outline = visual.getChildByName('__editor_outline__') as PIXI.Graphics;
    if (!outline) {
      outline = new PIXI.Graphics();
      outline.name = '__editor_outline__';
      visual.addChild(outline);
    }
    outline.clear();

    const drawShape = (g: PIXI.Graphics, t: string, d: any) => {
      switch (t) {
        case 'ball_blue':
        case 'ball_pink':
          g.circle(0, 0, BALL_RADIUS);
          break;
        case 'obstacle':
        case 'falling':
          {
            const subType = d.type || 'rectangle';
            if (subType === 'circle') {
              g.circle(0, 0, d.radius || d.width / 2);
            } else if (subType === 'triangle') {
              if (d.points && d.points.length === 3) {
                const [v1, v2, v3] = d.points;
                g.poly([v1.x, v1.y, v2.x, v2.y, v3.x, v3.y]);
              }
            } else if (subType === 'c_shape') {
              if (d.points && d.points.length === 3 && d.thickness) {
                const p1 = d.points[0], p2 = d.points[1], p3 = d.points[2];
                const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y, x3 = p3.x, y3 = p3.y;
                const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
                if (Math.abs(D) > 0.001) {
                  const centerX = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / D;
                  const centerY = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / D;
                  const arcRadius = Math.sqrt(Math.pow(x1 - centerX, 2) + Math.pow(y1 - centerY, 2));
                  let angle1 = Math.atan2(y1 - centerY, x1 - centerX);
                  let angle2 = Math.atan2(y2 - centerY, x2 - centerX);
                  let angle3 = Math.atan2(y3 - centerY, x3 - centerX);
                  const normalize = (a: number) => (a + 2 * Math.PI) % (2 * Math.PI);
                  const isCCW = normalize(angle2 - angle1) < normalize(angle3 - angle1);
                  g.arc(centerX, centerY, arcRadius, angle1, angle3, !isCCW);
                } else {
                  // Collinear, treat as straight line (though unlikely for c-shape)
                  g.moveTo(p1.x, p1.y);
                  g.lineTo(p2.x, p2.y);
                  g.lineTo(p3.x, p3.y);
                }
              }
            } else if (subType === 'bezier') {
              // Draw shape-accurate bezier outline for selection highlight
              if (d.points && d.points.length === 3 && d.thickness) {
                const p0 = d.points[0];
                const p1 = d.points[1];
                const p2 = d.points[2];
                const cpX = 2 * p1.x - 0.5 * p0.x - 0.5 * p2.x;
                const cpY = 2 * p1.y - 0.5 * p0.y - 0.5 * p2.y;

                // Stroke the bezier as the selection path
                g.moveTo(p0.x, p0.y);
                g.quadraticCurveTo(cpX, cpY, p2.x, p2.y);

                // For thicker selection (rounded caps), use stroke options below when applying stroke
              }
            } else {
              const w = d.width || 100;
              const h = d.height || 100;
              g.rect(-w / 2, -h / 2, w, h);
            }
          }
          break;
        case 'net':
          g.roundRect(-d.width / 2, -d.height / 2, d.width, d.height, 5);
          break;
        case 'conveyor':
          // Correct outlined shape (rectangle with rounded semi-circle ends)
          const w = d.width;
          const r = CONVEYOR_BELT_HEIGHT / 2;
          g.moveTo(-w / 2, -r);
          g.lineTo(w / 2, -r);
          g.arc(w / 2, 0, r, -Math.PI / 2, Math.PI / 2);
          g.lineTo(-w / 2, r);
          g.arc(-w / 2, 0, r, Math.PI / 2, -Math.PI / 2);
          g.closePath();
          break;
        case 'ice':
        case 'seesaw':
          g.rect(-d.width / 2, -d.height / 2, d.width, d.height);
          break;
        case 'button':
          // T-shape path
          g.poly([
            -16, -20,  // Top-left
            16, -20,   // Top-right
            16, -15,   // Top-bar bottom-right
            2.5, -15,  // stem right top
            2.5, 20,   // stem bottom-right
            -2.5, 20,  // stem bottom-left
            -2.5, -15, // stem left top
            -16, -15   // Top-bar bottom-left
          ]);
          g.closePath();
          break;
        case 'laser':
          {
            const dx = d.x2 - d.x1;
            const dy = d.y2 - d.y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const lh = 20; // Standard laser height
            g.rect(-len / 2, -lh / 2, len, lh);
          }
          break;
      }
    };

    drawShape(outline, type, data);

    if (type === 'obstacle' && data.type === 'c_shape') {
      outline.stroke({
        width: data.thickness + thickness,
        color: color,
        alpha: EDITOR_SELECTION_ALPHA,
        cap: 'round',
        join: 'round'
      });
    } else if (type === 'obstacle' && data.type === 'bezier') {
      // For bezier, stroke using thickness + selection thickness and rounded caps
      const strokeWidth = (data.thickness || 20) + thickness;
      outline.stroke({
        width: strokeWidth,
        color: color,
        alpha: EDITOR_SELECTION_ALPHA,
        cap: 'round',
        join: 'round'
      });
    } else {
      outline.stroke({ width: thickness, color: color, alpha: EDITOR_SELECTION_ALPHA });
    }
  }

  private setupEditorObject(visual: PIXI.Container, data: any, type: string, initialSelect: boolean = false) {
    const scaleFactor = getScaleFactor();

    let posX = data.x;
    let posY = data.y;
    if (type === 'laser') {
      posX = (data.x1 + data.x2) / 2;
      posY = (data.y1 + data.y2) / 2;
    }

    visual.position.set(posX * scaleFactor, posY * scaleFactor);
    visual.scale.set(scaleFactor);

    // Set rotation for objects that have angle
    if (data.angle !== undefined && type !== 'laser') {
      visual.rotation = (data.angle * Math.PI) / 180;
    } else if (type === 'laser') {
      visual.rotation = Math.atan2(data.y2 - data.y1, data.x2 - data.x1);
    }

    // Initial Outline (Thin)
    this.updateEditorOutline(visual, type, data, EDITOR_OUTLINE_WIDTH_NORMAL, EDITOR_SELECTION_COLOR);

    // Setup click-to-select and direct drag interaction
    visual.eventMode = 'static';
    visual.cursor = 'move';
    visual.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      // Select the object first
      this.selectObject(visual, data, type);
      // Immediately trigger the gizmo's move handle with the same event
      if (this.transformGizmo) {
        this.transformGizmo.startMoveFromExternal(e);
      }
    });

    this.gameContainer.addChild(visual);
    this.editorObjects.push({ container: visual, data, type, lastFocused: 0 });

    // Auto-select newly created objects
    if (initialSelect) {
      this.selectObject(visual, data, type);
    }
  }

  private copySelectedObject() {
    if (!this.selectedObject || !this.editingLevel) return;
    const { data, type } = this.selectedObject;

    // Prevent copying balls
    if (type === 'ball_blue' || type === 'ball_pink') return;

    // Clone data
    const newData = JSON.parse(JSON.stringify(data));

    let visual: PIXI.Container | null = null;
    let list: any[] | null = null;

    if (type === 'obstacle') {
      list = this.editingLevel.obstacles;
      visual = Obstacle.createVisual(newData);
    } else if (type === 'falling') {
      if (!this.editingLevel.fallingObjects) this.editingLevel.fallingObjects = [];
      list = this.editingLevel.fallingObjects;
      visual = FallingObject.createVisual(newData);
    } else {
      // Special objects
      switch (type) {
        case 'conveyor':
          if (!this.editingLevel.conveyors) this.editingLevel.conveyors = [];
          list = this.editingLevel.conveyors;
          visual = ConveyorBelt.createVisual(newData);
          break;
        case 'net':
          if (!this.editingLevel.nets) this.editingLevel.nets = [];
          list = this.editingLevel.nets;
          visual = Net.createVisual(newData);
          break;
        case 'ice':
          if (!this.editingLevel.iceBlocks) this.editingLevel.iceBlocks = [];
          list = this.editingLevel.iceBlocks;
          visual = IceBlock.createVisual(newData);
          break;
        case 'laser':
          if (!this.editingLevel.lasers) this.editingLevel.lasers = [];
          list = this.editingLevel.lasers;
          if (this.laserTexture) {
            visual = Laser.createVisual(newData, this.laserTexture, 14);
          }
          break;
        case 'seesaw':
          if (!this.editingLevel.seesaws) this.editingLevel.seesaws = [];
          list = this.editingLevel.seesaws;
          visual = Seesaw.createVisual(newData);
          break;
        case 'button':
          if (!this.editingLevel.buttons) this.editingLevel.buttons = [];
          list = this.editingLevel.buttons;
          visual = Button.createVisual(newData);
          break;
      }
    }

    if (visual && list) {
      list.push(newData);
      this.markAsEdited();
      this.setupEditorObject(visual, newData, type, true); // Auto-select copied object
    }
  }


  private deleteSelectedObject() {
    if (!this.selectedObject || !this.editingLevel) return;
    const { container, data, type } = this.selectedObject;

    // Prevent deleting balls
    if (type === 'ball_blue' || type === 'ball_pink') return;

    // Remove from level data
    // Remove from level data
    this.markAsEdited();
    if (type === 'obstacle') {
      const index = this.editingLevel.obstacles.indexOf(data);
      if (index > -1) this.editingLevel.obstacles.splice(index, 1);
    } else if (type === 'falling' && this.editingLevel.fallingObjects) {
      const index = this.editingLevel.fallingObjects.indexOf(data);
      if (index > -1) this.editingLevel.fallingObjects.splice(index, 1);
    } else if (type === 'net' && this.editingLevel.nets) {
      const index = this.editingLevel.nets.indexOf(data);
      if (index > -1) this.editingLevel.nets.splice(index, 1);
    } else if (type === 'ice' && this.editingLevel.iceBlocks) {
      const index = this.editingLevel.iceBlocks.indexOf(data);
      if (index > -1) this.editingLevel.iceBlocks.splice(index, 1);
    } else if (type === 'laser' && this.editingLevel.lasers) {
      const index = this.editingLevel.lasers.indexOf(data);
      if (index > -1) this.editingLevel.lasers.splice(index, 1);
    } else if (type === 'seesaw' && this.editingLevel.seesaws) {
      const index = this.editingLevel.seesaws.indexOf(data);
      if (index > -1) this.editingLevel.seesaws.splice(index, 1);
    } else if (type === 'conveyor' && this.editingLevel.conveyors) {
      const index = this.editingLevel.conveyors.indexOf(data);
      if (index > -1) this.editingLevel.conveyors.splice(index, 1);
    } else if (type === 'button' && this.editingLevel.buttons) {
      const index = this.editingLevel.buttons.indexOf(data);
      if (index > -1) this.editingLevel.buttons.splice(index, 1);
    }

    // Remove Visual
    container.destroy();

    // Remove from editorObjects list
    const objIndex = this.editorObjects.findIndex(obj => obj.container === container);
    if (objIndex > -1) {
      this.editorObjects.splice(objIndex, 1);
    }

    // Deselect
    this.deselectObject();
  }

  private async saveLevel() {
    if (this.editingLevel) {
      await LevelService.getInstance().saveLocalDraft(this.editingLevel);
      this.editorHasChanged = false;
      console.log("Level Saved.");
    }
  }

  private handleEditorClose() {
    if (this.editorHasChanged) {
      this.showConfirmDialog(
        'Do you want to save your progress?',
        async () => {
          this.closeConfirmDialog();
          await this.saveLevel();
          this.showLevelSelection();
        },
        () => {
          this.closeConfirmDialog();
          this.showLevelSelection();
        },
        {
          confirmText: 'Save',
          cancelText: 'Discard',
          onDismiss: () => this.closeConfirmDialog()
        }
      );
    } else {
      // If content not modified, check if we need to auto-save status (Untested -> Draft)
      if (this.editingLevel && this.editingLevel.authorPassed && !this.initialAuthorPassed) {
        // Player passed the level without modifying it -> Auto Save status
        this.saveLevel().then(() => {
          this.showLevelSelection();
        });
      } else {
        this.showLevelSelection();
      }
    }
  }

  public addObject(type: string, subType: string = 'rectangle', initialEventData?: any): void {
    if (!this.editingLevel) return;

    const scaleFactor = getScaleFactor();

    // Determine Spawn Position
    let spawnX = getCanvasWidth() / 2;
    let spawnY = getCanvasHeight() / 2;

    if (initialEventData && initialEventData.global) {
      spawnX = initialEventData.global.x;
      spawnY = initialEventData.global.y;
    }

    const designX = spawnX / scaleFactor;
    const designY = spawnY / scaleFactor;

    let newObj: any = null;
    let visual: PIXI.Container | null = null;
    let list: any[] | null = null;
    let objTypeTag = '';

    if (type === 'obstacle') {
      list = this.editingLevel.obstacles;
      objTypeTag = 'obstacle';

      if (subType === 'circle') {
        newObj = { type: 'circle', radius: 50, x: designX, y: designY, angle: 0 };
      } else if (subType === 'triangle') {
        newObj = {
          type: 'triangle',
          x: designX,
          y: designY,
          angle: 0,
          points: [{ x: 0, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 }]
        };
      } else if (subType === 'c_shape') {
        newObj = {
          type: 'c_shape',
          x: designX,
          y: designY,
          angle: 0,
          points: [{ x: 50, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 0 }],
          thickness: 20,
          cap: 'round'
        };
      } else if (subType === 'bezier') {
        newObj = {
          type: 'bezier',
          x: designX,
          y: designY,
          angle: 0,
          points: [{ x: -60, y: 20 }, { x: 0, y: -40 }, { x: 60, y: 20 }], // Start, Middle (on-curve), End
          thickness: 20,
          cap: 'round'
        };
      } else {
        // Default to rectangle
        newObj = { type: 'rectangle', width: 100, height: 100, x: designX, y: designY, angle: 0 };
      }

      visual = Obstacle.createVisual(newObj);

    } else if (type === 'falling') {
      if (!this.editingLevel.fallingObjects) this.editingLevel.fallingObjects = [];
      list = this.editingLevel.fallingObjects;
      objTypeTag = 'falling';

      if (subType === 'circle') {
        newObj = { type: 'circle', radius: 50, x: designX, y: designY, angle: 0 };
      } else if (subType === 'triangle') {
        newObj = {
          type: 'triangle',
          x: designX,
          y: designY,
          angle: 0,
          points: [{ x: 0, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 }]
        };
      } else {
        // Default to rectangle
        newObj = { type: 'rectangle', width: 100, height: 100, x: designX, y: designY, angle: 0 };
      }

      visual = FallingObject.createVisual(newObj);

    } else if (type === 'special') {
      // Special Objects
      objTypeTag = subType; // e.g. 'conveyor', 'net'

      switch (subType) {
        case 'conveyor':
          if (!this.editingLevel.conveyors) this.editingLevel.conveyors = [];
          list = this.editingLevel.conveyors;
          newObj = { x: designX, y: designY, width: 300, angle: 0, acceleration: 2 };
          visual = ConveyorBelt.createVisual(newObj);
          break;
        case 'net':
          if (!this.editingLevel.nets) this.editingLevel.nets = [];
          list = this.editingLevel.nets;
          newObj = { x: designX, y: designY, width: 150, height: 100, angle: 0 };
          visual = Net.createVisual(newObj);
          break;
        case 'ice':
          if (!this.editingLevel.iceBlocks) this.editingLevel.iceBlocks = [];
          list = this.editingLevel.iceBlocks;
          newObj = { x: designX, y: designY, width: 100, height: 100, meltTime: 1, angle: 0 };
          visual = IceBlock.createVisual(newObj);
          break;
        case 'laser':
          if (!this.editingLevel.lasers) this.editingLevel.lasers = [];
          list = this.editingLevel.lasers;
          // Laser defined by start/end points. 
          // Default to horizontal line centered at designX, Y
          newObj = { x1: designX - 100, y1: designY, x2: designX + 100, y2: designY };
          if (!this.laserTexture) return;
          visual = Laser.createVisual(newObj, this.laserTexture, 14);
          break;
        case 'seesaw':
          if (!this.editingLevel.seesaws) this.editingLevel.seesaws = [];
          list = this.editingLevel.seesaws;
          newObj = { x: designX, y: designY, width: 300, height: 20, angle: 0 };
          visual = Seesaw.createVisual(newObj);
          break;
        case 'button':
          if (!this.editingLevel.buttons) this.editingLevel.buttons = [];
          list = this.editingLevel.buttons;
          newObj = { x: designX, y: designY, angle: 0 };
          visual = Button.createVisual(newObj);
          break;
      }
    }

    if (visual && newObj && list) {
      list.push(newObj);
      this.markAsEdited();
      this.setupEditorObject(visual, newObj, objTypeTag, true); // Auto-select new objects

      // If created via drag, immediately start dragging
      if (initialEventData && this.transformGizmo) {
        this.transformGizmo.startMoveFromExternal(initialEventData);
      }
    }

  }

  private async toggleTestPlay() {
    if (!this.editingLevel) return;

    // Ensure state is updated even if we were somehow in a weird state
    // We trust the UI event that triggered this.

    if (this.editorUI) {
      // Do not hide UI, just update mode
      this.editorUI.setUIState('play');
    }

    await this.startLevel(this.editingLevel);

    // Ensure EditorUI remains visible and in play mode
    if (this.editorUI) {
      this.editorUI.visible = true;
      this.editorUI.setUIState('play');
      // Important: Set eventMode to passive/none so clicks pass to game, 
      // BUT we still need the Top Bar (Toggle) to receive clicks.
      // EditorUI uses specific hit areas, so as long as we don't have a fullscreen transparent hit area, we are fine.
      // EditorUI container default has no hit area.
    }
  }
}

