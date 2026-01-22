import * as PIXI from 'pixi.js';
import RAPIER from '@dimforge/rapier2d-compat';
import {
  SCALE,
  SEESAW_COLOR,
  SEESAW_PIVOT_COLOR,
  SEESAW_DENSITY,
  SEESAW_FRICTION,
  SEESAW_RESTITUTION,
  SEESAW_ANGULAR_DAMPING,
  SEESAW_PIVOT_STIFFNESS,
  SEESAW_PIVOT_DAMPING,
  COLLISION_GROUP,
} from '../config';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import type { SeesawConfig } from '../levels/LevelSchema';

export class Seesaw {
  public graphics: PIXI.Container;
  public plankGraphics: PIXI.Graphics;
  public pivotGraphics: PIXI.Graphics;
  public plankBody: RAPIER.RigidBody;
  public pivotBody: RAPIER.RigidBody;
  public anchorBody: RAPIER.RigidBody;
  public collider: RAPIER.Collider;
  public revoluteJoint: RAPIER.ImpulseJoint;
  public springJoint: RAPIER.ImpulseJoint;

  constructor(physicsWorld: PhysicsWorld, config: SeesawConfig) {

    const { x, y, width, height, angle = 0 } = config;
    const angleRad = (angle * Math.PI) / 180;

    // Create visuals
    this.graphics = Seesaw.createVisual(config);
    // Force container to 0,0 locally because we update children to absolute world coordinates
    this.graphics.position.set(0, 0);
    this.graphics.rotation = 0;

    // Retrieve references so we can update them
    this.plankGraphics = this.graphics.children[0] as PIXI.Graphics;
    this.pivotGraphics = this.graphics.children[1] as PIXI.Graphics;

    const world = physicsWorld.getWorld();
    const R = physicsWorld.getRAPIER();

    const physicsPos = physicsWorld.toPhysics(x, y);

    // 1. Fixed anchor body (immovable reference point)
    const anchorBodyDesc = R.RigidBodyDesc.fixed()
      .setTranslation(physicsPos.x, physicsPos.y);
    this.anchorBody = world.createRigidBody(anchorBodyDesc);

    // 2. Dynamic pivot body (can move slightly, no gravity, very high mass)
    const pivotBodyDesc = R.RigidBodyDesc.dynamic()
      .setTranslation(physicsPos.x, physicsPos.y)
      .setGravityScale(0);  // No gravity - damping controlled by spring joint
    this.pivotBody = world.createRigidBody(pivotBodyDesc);

    // Give pivot very high mass so it strongly resists movement
    const pivotColliderDesc = R.ColliderDesc.ball(0.01)
      .setDensity(10000.0)  // Extremely high density = high mass
      .setCollisionGroups(0);
    world.createCollider(pivotColliderDesc, this.pivotBody);

    // 3. Spring joint: connects anchor to pivot (soft constraint)
    const springJointData = R.JointData.spring(
      0,  // rest length = 0 (want pivot at anchor position)
      SEESAW_PIVOT_STIFFNESS,
      SEESAW_PIVOT_DAMPING,
      { x: 0, y: 0 },
      { x: 0, y: 0 }
    );
    this.springJoint = world.createImpulseJoint(springJointData, this.anchorBody, this.pivotBody, true);

    // 4. Dynamic plank body
    const plankBodyDesc = R.RigidBodyDesc.dynamic()
      .setTranslation(physicsPos.x, physicsPos.y)
      .setRotation(-angleRad)
      .setAngularDamping(SEESAW_ANGULAR_DAMPING);
    this.plankBody = world.createRigidBody(plankBodyDesc);

    // Create collider for the plank
    const colliderDesc = R.ColliderDesc.cuboid(
      (width / 2) / SCALE,
      (height / 2) / SCALE
    )
      .setDensity(SEESAW_DENSITY)
      .setFriction(SEESAW_FRICTION)
      .setRestitution(SEESAW_RESTITUTION)
      .setCollisionGroups(COLLISION_GROUP.SEESAW);

    this.collider = world.createCollider(colliderDesc, this.plankBody);

    // 5. Revolute joint: connects pivot to plank (allows rotation)
    const revoluteJointData = R.JointData.revolute(
      { x: 0, y: 0 },
      { x: 0, y: 0 }
    );
    this.revoluteJoint = world.createImpulseJoint(revoluteJointData, this.pivotBody, this.plankBody, true);
  }

  /**
   * Apply extra damping for small oscillations to help convergence
   */
  applyForces(): void {
    const vel = this.pivotBody.linvel();
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

    // Apply extra "static friction" style damping when speed is low
    // This helps small oscillations die out faster
    const lowSpeedThreshold = 10;
    if (speed > 0.001 && speed < lowSpeedThreshold) {
      // Stronger damping factor for low speeds (inversely proportional to speed)
      const extraDampingFactor = 30.0 * (1 - speed / lowSpeedThreshold);
      const dampingForceX = -extraDampingFactor * vel.x;
      const dampingForceY = -extraDampingFactor * vel.y;

      this.pivotBody.addForce({ x: dampingForceX, y: dampingForceY }, true);
    }
  }

  getColliderHandle(): number {
    return this.collider.handle;
  }

  /**
   * Update graphics from physics
   */
  update(scaleFactor: number = 1): void {
    const pos = this.plankBody.translation();
    const angle = this.plankBody.rotation();

    // Convert physics coordinates to pixel coordinates and apply responsive scaling
    this.plankGraphics.position.x = pos.x * SCALE * scaleFactor;
    this.plankGraphics.position.y = -pos.y * SCALE * scaleFactor;
    this.plankGraphics.rotation = -angle;
    this.plankGraphics.scale.set(scaleFactor);

    // Pivot graphics also need to be scaled and repoistioned even if seemingly fixed
    const anchorPos = this.anchorBody.translation();
    this.pivotGraphics.position.x = anchorPos.x * SCALE * scaleFactor;
    this.pivotGraphics.position.y = -anchorPos.y * SCALE * scaleFactor;
    this.pivotGraphics.scale.set(scaleFactor);
  }

  destroy(physicsWorld: PhysicsWorld): void {
    const world = physicsWorld.getWorld();

    // Remove joints first
    world.removeImpulseJoint(this.revoluteJoint, true);
    world.removeImpulseJoint(this.springJoint, true);

    // Remove bodies
    world.removeRigidBody(this.plankBody);
    world.removeRigidBody(this.pivotBody);
    world.removeRigidBody(this.anchorBody);

    this.graphics.destroy({ children: true });
  }

  static createVisual(config: SeesawConfig): PIXI.Container {
    const { width, height, x, y, angle = 0 } = config;

    // Create main container (rotation handled by parent in editor)
    const graphics = new PIXI.Container();
    graphics.position.set(x, y);

    // Create Plank Graphics
    const plankGraphics = new PIXI.Graphics();
    plankGraphics.rect(-width / 2, -height / 2, width, height);
    plankGraphics.fill({ color: SEESAW_COLOR });

    // Set initial position for plank
    plankGraphics.position.set(0, 0);

    // Set initial rotation for the container instead of the plank
    // This fixes the editor issue where the container is rotated by Gizmo, causing double rotation if plank is also rotated
    graphics.rotation = (angle * Math.PI) / 180;

    // Create Pivot (Axis) Graphics
    const pivotGraphics = new PIXI.Graphics();
    const pivotOuterRadius = Math.min(width, height) * 0.25;
    const pivotInnerRadius = pivotOuterRadius * 0.5;

    // Draw outer circle
    pivotGraphics.circle(0, 0, pivotOuterRadius);
    pivotGraphics.fill({ color: SEESAW_PIVOT_COLOR });

    // Draw inner circle (gray background)
    pivotGraphics.circle(0, 0, pivotInnerRadius);
    pivotGraphics.fill({ color: 0xC8C8C8 });

    // Pivot is fixed at the anchor position
    pivotGraphics.position.set(0, 0);

    // Add children to container
    // Add plank first, then pivot on top
    graphics.addChild(plankGraphics);
    graphics.addChild(pivotGraphics);

    return graphics;
  }
}
