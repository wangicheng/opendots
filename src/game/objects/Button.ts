/**
 * Button Game Object
 * A T-shaped button that triggers laser removal when touched by a ball
 */

import * as PIXI from 'pixi.js';
import RAPIER from '@dimforge/rapier2d-compat';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SCALE, COLLISION_GROUP } from '../config';
import type { ButtonConfig } from '../levels/LevelSchema';

// Button appearance constants
const BUTTON_COLOR = 0xA0A0A0;
const BUTTON_THICKNESS = 5;
const HORIZONTAL_BAR_WIDTH = 32;  // Slightly shorter than vertical
const VERTICAL_BAR_HEIGHT = 40;

// Sink animation constants
const SINK_DURATION = 0.25;  // seconds

export class Button {
  public graphics: PIXI.Graphics;
  public body: RAPIER.RigidBody;
  public colliders: RAPIER.Collider[] = [];

  private angle: number;  // radians
  private verticalBarHeight: number;
  private isSinking: boolean = false;
  private sinkProgress: number = 0;
  private sinkCallback: (() => void) | null = null;
  private initialPhysicsPos: { x: number, y: number };
  private initialPixelPos: { x: number, y: number };

  constructor(physicsWorld: PhysicsWorld, config: ButtonConfig) {
    const { x, y, angle = 0 } = config;
    this.angle = (angle * Math.PI) / 180;
    this.verticalBarHeight = VERTICAL_BAR_HEIGHT;

    // Create graphics
    this.graphics = new PIXI.Graphics();
    this.graphics.position.set(x, y);
    this.graphics.rotation = this.angle;

    this.drawTShape();

    // Physics setup
    const world = physicsWorld.getWorld();
    const R = physicsWorld.getRAPIER();

    // Create static body
    const physicsPos = physicsWorld.toPhysics(x, y);
    this.initialPhysicsPos = { x: physicsPos.x, y: physicsPos.y };
    this.initialPixelPos = { x, y };

    const rigidBodyDesc = R.RigidBodyDesc.fixed()
      .setTranslation(physicsPos.x, physicsPos.y)
      .setRotation(-this.angle);

    this.body = world.createRigidBody(rigidBodyDesc);

    // Create colliders for T-shape (two rectangles)
    // Horizontal bar (top of T)
    const hBarDesc = R.ColliderDesc.cuboid(
      (HORIZONTAL_BAR_WIDTH / 2) / SCALE,
      (BUTTON_THICKNESS / 2) / SCALE
    )
      .setTranslation(0, (VERTICAL_BAR_HEIGHT / 2 - BUTTON_THICKNESS / 2) / SCALE)
      .setFriction(0)  // No friction
      .setRestitution(0)
      .setCollisionGroups(COLLISION_GROUP.BUTTON)
      .setSensor(false)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

    this.colliders.push(world.createCollider(hBarDesc, this.body));

    // Vertical bar (stem of T)
    const vBarDesc = R.ColliderDesc.cuboid(
      (BUTTON_THICKNESS / 2) / SCALE,
      (VERTICAL_BAR_HEIGHT / 2) / SCALE
    )
      .setFriction(0)  // No friction
      .setRestitution(0)
      .setCollisionGroups(COLLISION_GROUP.BUTTON)
      .setSensor(false)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

    this.colliders.push(world.createCollider(vBarDesc, this.body));
  }

  private drawTShape(): void {
    this.graphics.clear();

    // Draw horizontal bar (top of T) - centered at top
    const hBarY = -VERTICAL_BAR_HEIGHT / 2 + BUTTON_THICKNESS / 2;
    this.graphics.rect(
      -HORIZONTAL_BAR_WIDTH / 2,
      hBarY - BUTTON_THICKNESS / 2,
      HORIZONTAL_BAR_WIDTH,
      BUTTON_THICKNESS
    );

    // Draw vertical bar (stem of T) - centered
    this.graphics.rect(
      -BUTTON_THICKNESS / 2,
      -VERTICAL_BAR_HEIGHT / 2,
      BUTTON_THICKNESS,
      VERTICAL_BAR_HEIGHT
    );

    this.graphics.fill({ color: BUTTON_COLOR });
  }

  /**
   * Get collider handles for collision detection
   */
  getColliderHandles(): number[] {
    return this.colliders.map(c => c.handle);
  }

  /**
   * Trigger sink animation
   * @param onComplete Callback when animation completes
   */
  triggerSink(onComplete: () => void): void {
    if (this.isSinking) return;
    this.isSinking = true;
    this.sinkProgress = 0;
    this.sinkCallback = onComplete;
  }

  /**
   * Update button state (handles sink animation)
   * @param deltaTime Time since last update in seconds
   */
  update(deltaTime: number): void {
    if (!this.isSinking) return;

    this.sinkProgress += deltaTime / SINK_DURATION;

    if (this.sinkProgress >= 1) {
      // Animation complete
      if (this.sinkCallback) {
        this.sinkCallback();
      }
      return;
    }

    // Calculate sink distance
    const sinkDistance = this.verticalBarHeight / 3;
    const currentSink = sinkDistance * this.sinkProgress;

    // Move in the direction of the angle (angle=0 means downward in screen coords)
    // In Pixi, Y increases downward, so angle=0 should move +Y
    const sinkX = -Math.sin(this.angle) * currentSink;
    const sinkY = Math.cos(this.angle) * currentSink;

    // Update visual position
    this.graphics.position.set(
      this.initialPixelPos.x + sinkX,
      this.initialPixelPos.y + sinkY
    );

    // Update physics body position
    // Note: Physics Y is inverted relative to screen Y
    this.body.setTranslation({
      x: this.initialPhysicsPos.x + (sinkX / SCALE),
      y: this.initialPhysicsPos.y - (sinkY / SCALE)
    }, true);
  }

  /**
   * Clean up resources
   */
  destroy(physicsWorld: PhysicsWorld): void {
    physicsWorld.getWorld().removeRigidBody(this.body);
    this.graphics.destroy();
  }
}
