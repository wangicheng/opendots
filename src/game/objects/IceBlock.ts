/**
 * IceBlock Game Object
 * A semi-transparent ice block that melts when touched by other objects
 */

import * as PIXI from 'pixi.js';
import RAPIER from '@dimforge/rapier2d-compat';
import {
  SCALE,
  ICE_BLOCK_COLOR,
  ICE_BLOCK_ALPHA,
  COLLISION_GROUP,
} from '../config';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import type { IceBlockConfig } from '../levels/LevelSchema';

export class IceBlock {
  public graphics: PIXI.Graphics;
  public body: RAPIER.RigidBody;
  public collider: RAPIER.Collider;

  private meltTime: number; // Duration in seconds (1, 2, or 3)
  private isMelting: boolean = false;
  private meltProgress: number = 0; // 0 to 1
  private initialAlpha: number;
  private width: number;
  private height: number;

  constructor(physicsWorld: PhysicsWorld, config: IceBlockConfig) {
    this.meltTime = config.meltTime || 1;
    this.initialAlpha = ICE_BLOCK_ALPHA;
    this.width = config.width;
    this.height = config.height;

    const { x, y, width, height, angle = 0 } = config;

    // Create Pixi.js graphics
    this.graphics = new PIXI.Graphics();
    this.drawIceBlock();

    // Set position and rotation
    this.graphics.position.set(x, y);
    this.graphics.rotation = (angle * Math.PI) / 180;

    // Create physics body
    const world = physicsWorld.getWorld();
    const R = physicsWorld.getRAPIER();

    const physicsPos = physicsWorld.toPhysics(x, y);
    const rigidBodyDesc = R.RigidBodyDesc.fixed()
      .setTranslation(physicsPos.x, physicsPos.y)
      .setRotation(-(angle * Math.PI) / 180);

    this.body = world.createRigidBody(rigidBodyDesc);

    // Create collider
    const colliderDesc = R.ColliderDesc.cuboid(
      (width / 2) / SCALE,
      (height / 2) / SCALE
    )
      .setCollisionGroups(COLLISION_GROUP.ICE_BLOCK)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

    this.collider = world.createCollider(colliderDesc, this.body);
  }

  /**
   * Draw the ice block graphics
   */
  private drawIceBlock(): void {
    this.graphics.clear();

    // Draw filled rectangle with transparency
    this.graphics.rect(-this.width / 2, -this.height / 2, this.width, this.height);
    this.graphics.fill({ color: ICE_BLOCK_COLOR, alpha: this.initialAlpha * (1 - this.meltProgress) });
  }

  /**
   * Start the melting process
   */
  startMelting(): void {
    if (!this.isMelting) {
      this.isMelting = true;
      this.meltProgress = 0;
    }
  }

  /**
   * Check if this ice block is currently melting
   */
  getIsMelting(): boolean {
    return this.isMelting;
  }

  /**
   * Update the ice block state
   * @param deltaTime Time since last update in seconds
   * @returns true if the ice block has fully melted and should be removed
   */
  update(deltaTime: number): boolean {
    if (!this.isMelting) return false;

    // Update melt progress
    this.meltProgress += deltaTime / this.meltTime;

    if (this.meltProgress >= 1) {
      return true; // Fully melted
    }

    // Redraw with updated alpha
    this.drawIceBlock();
    return false;
  }

  /**
   * Get the bounds of the ice block for drawing restriction
   */
  getBounds(): PIXI.Rectangle {
    const bounds = this.graphics.getBounds();
    return new PIXI.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  /**
   * Get the collider handle for collision detection
   */
  getColliderHandle(): number {
    return this.collider.handle;
  }

  /**
   * Clean up resources
   */
  destroy(physicsWorld: PhysicsWorld): void {
    physicsWorld.getWorld().removeRigidBody(this.body);
    this.graphics.destroy();
  }
}
