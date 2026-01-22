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
        if (!points || points.length !== 3) {
          console.error('Triangle obstacle requires 3 points');
          return;
        }
        const [v1, v2, v3] = points;

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

      case 'bezier': {
        // Defined by 3 points: Start, Middle (on curve), End
        if (points && points.length === 3 && thickness) {
          const { cap = 'round' } = config;
          const p0 = points[0];
          const p1 = points[1]; // Point ON the curve (t=0.5)
          const p2 = points[2];

          // Calculate implicit control point 'cp'
          // p1 = 0.25*p0 + 0.5*cp + 0.25*p2
          // 0.5*cp = p1 - 0.25*p0 - 0.25*p2
          // cp = 2*p1 - 0.5*p0 - 0.5*p2
          const cpX = 2 * p1.x - 0.5 * p0.x - 0.5 * p2.x;
          const cpY = 2 * p1.y - 0.5 * p0.y - 0.5 * p2.y;

          // Physics approximation with segments
          const segments = 10;
          const step = 1 / segments;

          let prevX = p0.x;
          let prevY = p0.y;

          for (let i = 1; i <= segments; i++) {
            const t = i * step;
            // Quadratic Bezier Formula: (1-t)^2 * P0 + 2(1-t)t * CP + t^2 * P2
            const oneMinusT = 1 - t;
            const t2 = t * t;

            const currX = oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * cpX + t2 * p2.x;
            const currY = oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * cpY + t2 * p2.y;

            // Create segment collider
            const dx = currX - prevX;
            const dy = currY - prevY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            const midX = (prevX + currX) / 2;
            const midY = (prevY + currY) / 2;

            const pCenter = physicsWorld.toPhysics(midX, midY);

            const colliderDesc = R.ColliderDesc.cuboid(
              (dist / 2) / SCALE,
              (thickness / 2) / SCALE
            )
              .setTranslation(pCenter.x, pCenter.y)
              .setRotation(-angle)
              .setFriction(OBSTACLE_FRICTION)
              .setRestitution(OBSTACLE_RESTITUTION)
              .setDensity(OBSTACLE_DENSITY)
              .setCollisionGroups(COLLISION_GROUP.OBSTACLE);

            this.colliders.push(world.createCollider(colliderDesc, this.body));

            prevX = currX;
            prevY = currY;
          }

          // Add Round Caps if requested (Start and End only)
          if (cap === 'round') {
            const capRadius = thickness / 2;

            // Start Cap
            const startPos = physicsWorld.toPhysics(p0.x, p0.y);
            const startCollider = R.ColliderDesc.ball(capRadius / SCALE)
              .setTranslation(startPos.x, startPos.y)
              .setFriction(OBSTACLE_FRICTION)
              .setRestitution(OBSTACLE_RESTITUTION)
              .setDensity(OBSTACLE_DENSITY)
              .setCollisionGroups(COLLISION_GROUP.OBSTACLE);
            this.colliders.push(world.createCollider(startCollider, this.body));

            // End Cap
            const endPos = physicsWorld.toPhysics(p2.x, p2.y);
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
        if (!points || points.length !== 3) {
          return graphics;
        }
        const [v1, v2, v3] = points;

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

      case 'bezier': {
        // Defined by 3 points: Start, Middle (on curve), End
        if (points && points.length === 3 && thickness) {
          const { cap = 'round' } = config;
          const p0 = points[0];
          const p1 = points[1];
          const p2 = points[2];

          // Calculate implicit control point 'cp'
          const cpX = 2 * p1.x - 0.5 * p0.x - 0.5 * p2.x;
          const cpY = 2 * p1.y - 0.5 * p0.y - 0.5 * p2.y;

          graphics.moveTo(p0.x, p0.y);
          graphics.quadraticCurveTo(cpX, cpY, p2.x, p2.y);
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
