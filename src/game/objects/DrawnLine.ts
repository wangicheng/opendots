import * as PIXI from 'pixi.js';
import RAPIER from '@dimforge/rapier2d-compat';
import { SCALE } from '../config';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import type { Point } from '../utils/douglasPeucker';
import { drawLineWithCornerStyle, createLinePhysicsColliders } from '../utils/lineRenderer';
import type { Pen } from '../data/PenData';

export class DrawnLine {
  public graphics: PIXI.Graphics;
  public body: RAPIER.RigidBody;
  public colliders: RAPIER.Collider[] = [];
  private points: Point[];
  private physicsWorld: PhysicsWorld;
  private pen: Pen;

  constructor(physicsWorld: PhysicsWorld, points: Point[], pen: Pen) {
    this.points = points;
    this.physicsWorld = physicsWorld;
    this.pen = pen;

    // Calculate centroid for body position
    const centroid = this.calculateCentroid(points);

    // Create Pixi.js graphics
    this.graphics = new PIXI.Graphics();
    this.drawLine(centroid);
    this.graphics.position.set(centroid.x, centroid.y);

    // Convert to physics coordinates
    const physicsPos = physicsWorld.toPhysics(centroid.x, centroid.y);
    const R = physicsWorld.getRAPIER();

    // Create Rapier dynamic body
    const rigidBodyDesc = R.RigidBodyDesc.dynamic()
      .setTranslation(physicsPos.x, physicsPos.y);

    this.body = physicsWorld.getWorld().createRigidBody(rigidBodyDesc);

    // Create physics colliders for each segment
    this.createPhysicsSegments(centroid);
  }

  /**
   * Calculate the centroid of all points
   */
  private calculateCentroid(points: Point[]): Point {
    let sumX = 0;
    let sumY = 0;
    for (const point of points) {
      sumX += point.x;
      sumY += point.y;
    }
    return {
      x: sumX / points.length,
      y: sumY / points.length,
    };
  }

  /**
   * Draw the line with custom corner styles
   */
  private drawLine(centroid: Point): void {
    drawLineWithCornerStyle(
      this.graphics,
      this.points,
      this.pen.color,
      this.pen.width,
      centroid
    );
  }

  /**
   * Create physics colliders for each line segment with matching corner styles
   */
  private createPhysicsSegments(centroid: Point): void {
    const world = this.physicsWorld.getWorld();
    const R = this.physicsWorld.getRAPIER();

    this.colliders = createLinePhysicsColliders(
      this.points,
      centroid,
      this.body,
      world,
      R,
      this.pen.width,
      this.pen.density,
      this.pen.friction,
      this.pen.restitution
    );
  }

  /**
   * Update graphics position from physics body
   */
  update(): void {
    const pos = this.body.translation();
    const angle = this.body.rotation();

    // Convert physics coordinates to pixel coordinates
    this.graphics.position.x = pos.x * SCALE;
    this.graphics.position.y = -pos.y * SCALE;
    this.graphics.rotation = -angle;
  }

  /**
   * Destroy the line
   */
  destroy(physicsWorld: PhysicsWorld): void {
    if (this.body) {
      physicsWorld.getWorld().removeRigidBody(this.body);
    }
    this.graphics.destroy();
  }
}
