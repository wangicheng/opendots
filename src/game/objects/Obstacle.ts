import * as PIXI from 'pixi.js';
import RAPIER from '@dimforge/rapier2d-compat';
import {
  SCALE,
  OBSTACLE_COLOR,
  OBSTACLE_FRICTION,
  OBSTACLE_RESTITUTION,
  OBSTACLE_DENSITY,
  COLLISION_GROUP,
} from '../config';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import type { ObstacleConfig } from '../levels/LevelSchema';

export class Obstacle {
  public graphics: PIXI.Graphics;
  public body: RAPIER.RigidBody;
  public colliders: RAPIER.Collider[] = [];

  constructor(
    physicsWorld: PhysicsWorld,
    config: ObstacleConfig
  ) {
    const {
      type = 'rectangle',
      x,
      y,
      width = 0,
      height = 0,
      angle = 0,
      radius,
      points,
      thickness
    } = config;

    // Ignore angle for circles
    const effectiveAngle = type === 'circle' ? 0 : angle;

    // Create Pixi.js graphics
    this.graphics = new PIXI.Graphics();
    // Set position and rotation (Pixi)
    this.graphics.position.set(x, y);
    this.graphics.rotation = (effectiveAngle * Math.PI) / 180;

    const world = physicsWorld.getWorld();
    const R = physicsWorld.getRAPIER();

    // Create Rapier static body
    const physicsPos = physicsWorld.toPhysics(x, y);
    const rigidBodyDesc = R.RigidBodyDesc.fixed()
      .setTranslation(physicsPos.x, physicsPos.y)
      .setRotation(-(effectiveAngle * Math.PI) / 180);

    this.body = world.createRigidBody(rigidBodyDesc);

    switch (type) {
      case 'circle': {
        const r = radius || width / 2;
        this.graphics.circle(0, 0, r);
        this.graphics.fill({ color: OBSTACLE_COLOR });

        const colliderDesc = R.ColliderDesc.ball(r / SCALE)
          .setFriction(OBSTACLE_FRICTION)
          .setRestitution(OBSTACLE_RESTITUTION)
          .setDensity(OBSTACLE_DENSITY)
          .setCollisionGroups(COLLISION_GROUP.OBSTACLE);

        this.colliders.push(world.createCollider(colliderDesc, this.body));
        break;
      }

      case 'triangle': {
        const w = width;
        const h = height;
        // Vertices relative to (0,0)
        const v1 = { x: 0, y: -h / 2 };
        const v2 = { x: w / 2, y: h / 2 };
        const v3 = { x: -w / 2, y: h / 2 };

        this.graphics.poly([v1.x, v1.y, v2.x, v2.y, v3.x, v3.y]);
        this.graphics.fill({ color: OBSTACLE_COLOR });

        // Create convex hull from vertices (Rapier uses Float32Array)
        const vertices = new Float32Array([
          v1.x / SCALE, -v1.y / SCALE,
          v2.x / SCALE, -v2.y / SCALE,
          v3.x / SCALE, -v3.y / SCALE,
        ]);

        const colliderDesc = R.ColliderDesc.convexHull(vertices);
        if (colliderDesc) {
          colliderDesc
            .setFriction(OBSTACLE_FRICTION)
            .setRestitution(OBSTACLE_RESTITUTION)
            .setDensity(OBSTACLE_DENSITY)
            .setCollisionGroups(COLLISION_GROUP.OBSTACLE);

          this.colliders.push(world.createCollider(colliderDesc, this.body));
        }
        break;
      }

      case 'c_shape': {
        // Defined by 3 coordinates (points) determining an arc.
        if (points && points.length === 3 && thickness) {
          const { cap = 'round' } = config;

          const p1 = points[0];
          const p2 = points[1];
          const p3 = points[2];

          // Calculate center and radius of circle passing through p1, p2, p3
          const x1 = p1.x, y1 = p1.y;
          const x2 = p2.x, y2 = p2.y;
          const x3 = p3.x, y3 = p3.y;

          const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));

          if (Math.abs(D) < 0.001) {
            // Collinear points, treat as straight line
            this.graphics.moveTo(p1.x, p1.y);
            this.graphics.lineTo(p2.x, p2.y);
            this.graphics.lineTo(p3.x, p3.y);
            this.graphics.stroke({ width: thickness, color: OBSTACLE_COLOR, cap: cap === 'round' ? 'round' : 'butt', join: 'round' });
            return;
          }

          const centerX = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / D;
          const centerY = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / D;

          const arcRadius = Math.sqrt(Math.pow(x1 - centerX, 2) + Math.pow(y1 - centerY, 2));

          // Calculate angles
          let angle1 = Math.atan2(y1 - centerY, x1 - centerX);
          let angle3 = Math.atan2(y3 - centerY, x3 - centerX);

          function normalize(a: number) { return (a + 2 * Math.PI) % (2 * Math.PI); }
          const angle2 = Math.atan2(y2 - centerY, x2 - centerX);
          const relA2 = normalize(angle2 - angle1);
          const relA3 = normalize(angle3 - angle1);

          const isCCW = relA2 < relA3;

          this.graphics.clear();
          this.graphics.arc(centerX, centerY, arcRadius, angle1, angle3, !isCCW);
          this.graphics.stroke({ width: thickness, color: OBSTACLE_COLOR, cap: cap === 'round' ? 'round' : 'butt', join: 'round' });

          // Physics approximation with segments
          const segments = 10;

          let sweep = 0;
          if (relA2 < relA3) {
            sweep = relA3;
          } else {
            sweep = -(2 * Math.PI - relA3);
          }

          const angleStep = sweep / segments;

          for (let i = 0; i < segments; i++) {
            const thetaStart = angle1 + i * angleStep;
            const thetaMid = thetaStart + angleStep / 2;

            const segX = centerX + arcRadius * Math.cos(thetaMid);
            const segY = centerY + arcRadius * Math.sin(thetaMid);

            const segLen = 2 * arcRadius * Math.sin(Math.abs(angleStep) / 2);
            const segAngle = thetaMid + Math.PI / 2;

            const pCenter = physicsWorld.toPhysics(segX, segY);

            const colliderDesc = R.ColliderDesc.cuboid(
              (segLen / 2) / SCALE,
              (thickness / 2) / SCALE
            )
              .setTranslation(pCenter.x - physicsPos.x, pCenter.y - physicsPos.y)
              .setRotation(-segAngle)
              .setFriction(OBSTACLE_FRICTION)
              .setRestitution(OBSTACLE_RESTITUTION)
              .setDensity(OBSTACLE_DENSITY)
              .setCollisionGroups(COLLISION_GROUP.OBSTACLE);

            this.colliders.push(world.createCollider(colliderDesc, this.body));
          }

          // Add Round Caps if requested
          if (cap === 'round') {
            const capRadius = thickness / 2;

            const startX = centerX + arcRadius * Math.cos(angle1);
            const startY = centerY + arcRadius * Math.sin(angle1);
            const endX = centerX + arcRadius * Math.cos(angle3);
            const endY = centerY + arcRadius * Math.sin(angle3);

            const startPos = physicsWorld.toPhysics(startX, startY);
            const endPos = physicsWorld.toPhysics(endX, endY);

            const startCollider = R.ColliderDesc.ball(capRadius / SCALE)
              .setTranslation(startPos.x - physicsPos.x, startPos.y - physicsPos.y)
              .setFriction(OBSTACLE_FRICTION)
              .setRestitution(OBSTACLE_RESTITUTION)
              .setDensity(OBSTACLE_DENSITY)
              .setCollisionGroups(COLLISION_GROUP.OBSTACLE);

            this.colliders.push(world.createCollider(startCollider, this.body));

            const endCollider = R.ColliderDesc.ball(capRadius / SCALE)
              .setTranslation(endPos.x - physicsPos.x, endPos.y - physicsPos.y)
              .setFriction(OBSTACLE_FRICTION)
              .setRestitution(OBSTACLE_RESTITUTION)
              .setDensity(OBSTACLE_DENSITY)
              .setCollisionGroups(COLLISION_GROUP.OBSTACLE);

            this.colliders.push(world.createCollider(endCollider, this.body));
          }

          return;
        }
        break;
      }

      case 'square':
      case 'rectangle':
      default: {
        const w = (type === 'square' && width) ? width : (width || 0);
        const h = (type === 'square' && width) ? width : (height || 0);

        this.graphics.rect(-w / 2, -h / 2, w, h);
        this.graphics.fill({ color: OBSTACLE_COLOR });

        const colliderDesc = R.ColliderDesc.cuboid(
          (w / 2) / SCALE,
          (h / 2) / SCALE
        )
          .setFriction(OBSTACLE_FRICTION)
          .setRestitution(OBSTACLE_RESTITUTION)
          .setDensity(OBSTACLE_DENSITY)
          .setCollisionGroups(COLLISION_GROUP.OBSTACLE);

        this.colliders.push(world.createCollider(colliderDesc, this.body));
        break;
      }
    }
  }

  update(): void {
    // Static body, no update needed
  }

  /**
   * Get the global bounds of the obstacle
   */
  getBounds(): PIXI.Rectangle {
    const bounds = this.graphics.getBounds();
    return new PIXI.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  destroy(physicsWorld: PhysicsWorld): void {
    physicsWorld.getWorld().removeRigidBody(this.body);
    this.graphics.destroy();
  }
}
