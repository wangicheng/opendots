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

    // Ignore angle for circles only (c_shape uses angle for rotation)
    const effectiveAngle = type === 'circle' ? 0 : angle;

    // Create Pixi.js graphics
    this.graphics = Obstacle.createVisual(config);

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
            // Collinear points
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

            // Use pCenter direct relative coordinates (offset from body center)
            const colliderDesc = R.ColliderDesc.cuboid(
              (segLen / 2) / SCALE,
              (thickness / 2) / SCALE
            )
              .setTranslation(pCenter.x, pCenter.y)
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
              .setTranslation(startPos.x, startPos.y)
              .setFriction(OBSTACLE_FRICTION)
              .setRestitution(OBSTACLE_RESTITUTION)
              .setDensity(OBSTACLE_DENSITY)
              .setCollisionGroups(COLLISION_GROUP.OBSTACLE);

            this.colliders.push(world.createCollider(startCollider, this.body));

            const endCollider = R.ColliderDesc.ball(capRadius / SCALE)
              .setTranslation(endPos.x, endPos.y)
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

  static createVisual(config: ObstacleConfig): PIXI.Graphics {
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

    const graphics = new PIXI.Graphics();
    // Set position and rotation (Pixi)
    graphics.position.set(x, y);
    graphics.rotation = (effectiveAngle * Math.PI) / 180;

    switch (type) {
      case 'circle': {
        const r = radius || width / 2;
        graphics.circle(0, 0, r);
        graphics.fill({ color: OBSTACLE_COLOR });
        break;
      }

      case 'triangle': {
        const w = width;
        const h = height;
        // Vertices relative to (0,0)
        const v1 = { x: 0, y: -h / 2 };
        const v2 = { x: w / 2, y: h / 2 };
        const v3 = { x: -w / 2, y: h / 2 };

        graphics.poly([v1.x, v1.y, v2.x, v2.y, v3.x, v3.y]);
        graphics.fill({ color: OBSTACLE_COLOR });
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
            graphics.moveTo(p1.x, p1.y);
            graphics.lineTo(p2.x, p2.y);
            graphics.lineTo(p3.x, p3.y);
            graphics.stroke({ width: thickness, color: OBSTACLE_COLOR, cap: cap === 'round' ? 'round' : 'butt', join: 'round' });
            return graphics;
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

          graphics.clear();
          // Draw relative to center (centerX, centerY are relative)
          graphics.arc(centerX, centerY, arcRadius, angle1, angle3, !isCCW);
          graphics.stroke({ width: thickness, color: OBSTACLE_COLOR, cap: cap === 'round' ? 'round' : 'butt', join: 'round' });

          return graphics;
        }
        break;
      }

      case 'square':
      case 'rectangle':
      default: {
        const w = (type === 'square' && width) ? width : (width || 0);
        const h = (type === 'square' && width) ? width : (height || 0);

        graphics.rect(-w / 2, -h / 2, w, h);
        graphics.fill({ color: OBSTACLE_COLOR });
        break;
      }
    }
    return graphics;
  }

  update(scaleFactor: number = 1): void {
    const pos = this.body.translation();
    const angle = this.body.rotation();

    // Convert physics coordinates to pixel coordinates and apply responsive scaling
    this.graphics.position.x = pos.x * SCALE * scaleFactor;
    this.graphics.position.y = -pos.y * SCALE * scaleFactor;
    this.graphics.rotation = -angle;

    // Scale the graphics itself
    this.graphics.scale.set(scaleFactor);
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
