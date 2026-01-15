import * as PIXI from 'pixi.js';
import RAPIER from '@dimforge/rapier2d-compat';
import {
  SCALE,
  FALLING_OBJECT_COLOR,
  FALLING_OBJECT_FRICTION,
  FALLING_OBJECT_RESTITUTION,
  FALLING_OBJECT_DENSITY,
  COLLISION_GROUP,
} from '../config';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import type { FallingObjectConfig } from '../levels/LevelSchema';

export class FallingObject {
  public graphics: PIXI.Graphics;
  public body: RAPIER.RigidBody;
  public colliders: RAPIER.Collider[] = [];
  private physicsWorld: PhysicsWorld;

  constructor(
    physicsWorld: PhysicsWorld,
    config: FallingObjectConfig,
    startActive: boolean = false
  ) {
    this.physicsWorld = physicsWorld;

    const {
      type = 'rectangle',
      x,
      y,
      width = 0,
      height = 0,
      angle = 0,
      radius
    } = config;

    // Ignore angle for circles
    const effectiveAngle = type === 'circle' ? 0 : angle;

    // Create Pixi.js graphics
    this.graphics = new PIXI.Graphics();

    // Set initial position and rotation
    this.graphics.position.set(x, y);
    this.graphics.rotation = (effectiveAngle * Math.PI) / 180;

    const world = physicsWorld.getWorld();
    const R = physicsWorld.getRAPIER();

    // Create Rapier rigid body (fixed initially, can be activated later)
    const physicsPos = physicsWorld.toPhysics(x, y);
    const rigidBodyDesc = startActive
      ? R.RigidBodyDesc.dynamic()
      : R.RigidBodyDesc.fixed();

    rigidBodyDesc
      .setTranslation(physicsPos.x, physicsPos.y)
      .setRotation(-(effectiveAngle * Math.PI) / 180);

    this.body = world.createRigidBody(rigidBodyDesc);

    switch (type) {
      case 'circle': {
        const r = radius || width / 2;
        this.graphics.circle(0, 0, r);
        this.graphics.fill({ color: FALLING_OBJECT_COLOR });

        const colliderDesc = R.ColliderDesc.ball(r / SCALE)
          .setDensity(FALLING_OBJECT_DENSITY)
          .setFriction(FALLING_OBJECT_FRICTION)
          .setRestitution(FALLING_OBJECT_RESTITUTION)
          .setCollisionGroups(COLLISION_GROUP.FALLING_OBJECT);

        this.colliders.push(world.createCollider(colliderDesc, this.body));
        break;
      }

      case 'triangle': {
        const w = width;
        const h = height;
        const v1 = { x: 0, y: -h / 2 };
        const v2 = { x: w / 2, y: h / 2 };
        const v3 = { x: -w / 2, y: h / 2 };

        this.graphics.poly([v1.x, v1.y, v2.x, v2.y, v3.x, v3.y]);
        this.graphics.fill({ color: FALLING_OBJECT_COLOR });

        const vertices = new Float32Array([
          v1.x / SCALE, -v1.y / SCALE,
          v2.x / SCALE, -v2.y / SCALE,
          v3.x / SCALE, -v3.y / SCALE,
        ]);

        const colliderDesc = R.ColliderDesc.convexHull(vertices);
        if (colliderDesc) {
          colliderDesc
            .setDensity(FALLING_OBJECT_DENSITY)
            .setFriction(FALLING_OBJECT_FRICTION)
            .setRestitution(FALLING_OBJECT_RESTITUTION)
            .setCollisionGroups(COLLISION_GROUP.FALLING_OBJECT);

          this.colliders.push(world.createCollider(colliderDesc, this.body));
        }
        break;
      }

      case 'square':
      case 'rectangle':
      default: {
        const w = (type === 'square' && width) ? width : (width || 0);
        const h = (type === 'square' && width) ? width : (height || 0);

        this.graphics.rect(-w / 2, -h / 2, w, h);
        this.graphics.fill({ color: FALLING_OBJECT_COLOR });

        const colliderDesc = R.ColliderDesc.cuboid(
          (w / 2) / SCALE,
          (h / 2) / SCALE
        )
          .setDensity(FALLING_OBJECT_DENSITY)
          .setFriction(FALLING_OBJECT_FRICTION)
          .setRestitution(FALLING_OBJECT_RESTITUTION)
          .setCollisionGroups(COLLISION_GROUP.FALLING_OBJECT);

        this.colliders.push(world.createCollider(colliderDesc, this.body));
        break;
      }
    }
  }

  update(): void {
    const pos = this.body.translation();
    const angle = this.body.rotation();

    // Convert physics coordinates to pixel coordinates
    this.graphics.position.x = pos.x * SCALE;
    this.graphics.position.y = -pos.y * SCALE;
    this.graphics.rotation = -angle;
  }

  activate(): void {
    const R = this.physicsWorld.getRAPIER();
    if (this.body.bodyType() !== R.RigidBodyType.Dynamic) {
      this.body.setBodyType(R.RigidBodyType.Dynamic, true);
    }
  }

  destroy(physicsWorld: PhysicsWorld): void {
    physicsWorld.getWorld().removeRigidBody(this.body);
    this.graphics.destroy();
  }
}
