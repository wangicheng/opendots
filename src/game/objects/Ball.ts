/**
 * Ball Game Object
 * A circular physics object with Pixi.js rendering
 */

import * as PIXI from 'pixi.js';
import RAPIER from '@dimforge/rapier2d-compat';
import {
  SCALE,
  BALL_RADIUS,
  BALL_DENSITY,
  BALL_FRICTION,
  BALL_RESTITUTION,
  BALL_COLORS,
  COLLISION_GROUP,
} from '../config';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export type BallType = 'blue' | 'pink';

export class Ball {
  public graphics: PIXI.Graphics;
  public body: RAPIER.RigidBody;
  public collider: RAPIER.Collider;
  public readonly type: BallType;
  private physicsWorld: PhysicsWorld;
  private readonly radius: number;

  constructor(
    physicsWorld: PhysicsWorld,
    x: number, // pixel coordinates
    y: number,
    type: BallType = 'blue',
    startActive: boolean = false
  ) {
    this.physicsWorld = physicsWorld;
    this.type = type;
    this.radius = BALL_RADIUS;

    // Create Pixi.js graphics
    this.graphics = Ball.createVisual(x, y, type);

    // Convert to physics coordinates
    const physicsPos = physicsWorld.toPhysics(x, y);
    const R = physicsWorld.getRAPIER();

    // Create Rapier rigid body
    const rigidBodyDesc = startActive
      ? R.RigidBodyDesc.dynamic()
      : R.RigidBodyDesc.fixed();

    rigidBodyDesc
      .setTranslation(physicsPos.x, physicsPos.y)
      .setCcdEnabled(true); // Better collision detection for fast-moving objects

    this.body = physicsWorld.getWorld().createRigidBody(rigidBodyDesc);

    // Create circular collider
    const collisionGroup = type === 'blue'
      ? COLLISION_GROUP.BLUE_BALL
      : COLLISION_GROUP.PINK_BALL;

    const colliderDesc = R.ColliderDesc.ball(this.radius / SCALE)
      .setDensity(BALL_DENSITY)
      .setFriction(BALL_FRICTION)
      // Use Multiply combine rule for friction when this ball collides with others
      .setFrictionCombineRule(R.CoefficientCombineRule.Multiply)
      .setRestitution(BALL_RESTITUTION)
      .setCollisionGroups(collisionGroup)
      .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);

    this.collider = physicsWorld.getWorld().createCollider(colliderDesc, this.body);
  }

  /**
   * Draw the ball graphics
   */
  /**
   * Create the visual representation of the ball
   */
  static createVisual(x: number, y: number, type: BallType): PIXI.Graphics {
    const graphics = new PIXI.Graphics();
    const color = BALL_COLORS[type];

    graphics.circle(0, 0, BALL_RADIUS);
    graphics.fill({ color });
    graphics.position.set(x, y);

    return graphics;
  }

  /**
   * Update graphics position from physics body
   */
  update(scaleFactor: number = 1): void {
    const pos = this.body.translation();
    const angle = this.body.rotation();

    // Convert physics coordinates to pixel coordinates and apply responsive scaling
    this.graphics.position.x = pos.x * SCALE * scaleFactor;
    this.graphics.position.y = -pos.y * SCALE * scaleFactor;
    this.graphics.rotation = -angle;

    // Scale the graphics itself if needed (though it should be created at scaled size)
    this.graphics.scale.set(scaleFactor);
  }

  /**
   * Activate physics for the ball (make it dynamic)
   */
  activate(): void {
    const R = this.physicsWorld.getRAPIER();
    if (this.body.bodyType() !== R.RigidBodyType.Dynamic) {
      this.body.setBodyType(R.RigidBodyType.Dynamic, true);
    }
  }

  /**
   * Get the collider handle for collision detection
   */
  getColliderHandle(): number {
    return this.collider.handle;
  }

  /**
   * Get the global bounds of the ball
   */
  getBounds(): PIXI.Rectangle {
    const bounds = this.graphics.getBounds();
    return new PIXI.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  /**
   * Destroy the ball
   */
  destroy(physicsWorld: PhysicsWorld): void {
    physicsWorld.getWorld().removeRigidBody(this.body);
    this.graphics.destroy();
  }
}
