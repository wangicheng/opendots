/**
 * Line Renderer Utility
 * Handles custom corner/joint styles for drawn lines with consistent physics and rendering
 */

import * as PIXI from 'pixi.js';
import RAPIER from '@dimforge/rapier2d-compat';
import { SCALE, COLLISION_GROUP } from '../config';
import type { Point } from './douglasPeucker';

/** Threshold angle in radians (30 degrees) */
const MITER_ANGLE_THRESHOLD = Math.PI / 6; // 30 degrees

/** Maximum miter extension to prevent extremely long spikes */
const MAX_MITER_RATIO = 3.0;

interface SegmentInfo {
  p1: Point;
  p2: Point;
  dx: number;
  dy: number;
  length: number;
  angle: number;
  // Normalized vectors
  dirX: number;
  dirY: number;
  // Left normal vector (relative to direction in screen coords)
  leftX: number;
  leftY: number;
  // Right normal vector
  rightX: number;
  rightY: number;
}

/**
 * Calculate segment info for line segments
 */
function calculateSegmentInfo(p1: Point, p2: Point): SegmentInfo {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  const ndx = length > 0 ? dx / length : 0;
  const ndy = length > 0 ? dy / length : 0;

  // In Screen Coords (Y Down):
  // Dir = (dx, dy)
  // Left Normal = (dy, -dx)  <-- Rotate -90 deg
  // Right Normal = (-dy, dx) <-- Rotate +90 deg

  const leftX = ndy;
  const leftY = -ndx;

  const rightX = -ndy;
  const rightY = ndx;

  return { p1, p2, dx, dy, length, angle, dirX: ndx, dirY: ndy, leftX, leftY, rightX, rightY };
}

/**
 * Calculate the turn angle at a junction
 * Returns radians [0, PI]. 0 = Straight, PI = U-turn.
 */
function calculateTurnAngle(seg1: SegmentInfo, seg2: SegmentInfo): number {
  const dot = seg1.dirX * seg2.dirX + seg1.dirY * seg2.dirY;
  const clampedDot = Math.max(-1, Math.min(1, dot));
  return Math.PI - Math.acos(clampedDot);
}

/**
 * Determine if the turn is to the Right (Clockwise)
 * Screen Coords (Y Down):
 * Cross Product (z) = x1*y2 - y1*x2
 * Positive = Right Turn (CW)
 * Negative = Left Turn (CCW)
 */
function isRightTurn(seg1: SegmentInfo, seg2: SegmentInfo): boolean {
  const cross = seg1.dirX * seg2.dirY - seg1.dirY * seg2.dirX;
  return cross > 0;
}

/**
 * Find intersection of two lines defined by point and direction
 */
function lineIntersection(
  p1: Point, dir1: { x: number; y: number },
  p2: Point, dir2: { x: number; y: number }
): Point | null {
  const cross = dir1.x * dir2.y - dir1.y * dir2.x;
  if (Math.abs(cross) < 1e-10) return null;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const t = (dx * dir2.y - dy * dir2.x) / cross;

  return {
    x: p1.x + t * dir1.x,
    y: p1.y + t * dir1.y
  };
}

/**
 * Draw a single segment as a filled rectangle
 */
function drawSegmentRect(
  graphics: PIXI.Graphics,
  seg: SegmentInfo,
  halfWidth: number,
  offsetX: number,
  offsetY: number
): void {
  // Corners: P1_Left, P1_Right, P2_Right, P2_Left
  const p1lx = seg.p1.x + seg.leftX * halfWidth - offsetX;
  const p1ly = seg.p1.y + seg.leftY * halfWidth - offsetY;

  const p1rx = seg.p1.x + seg.rightX * halfWidth - offsetX;
  const p1ry = seg.p1.y + seg.rightY * halfWidth - offsetY;

  const p2rx = seg.p2.x + seg.rightX * halfWidth - offsetX;
  const p2ry = seg.p2.y + seg.rightY * halfWidth - offsetY;

  const p2lx = seg.p2.x + seg.leftX * halfWidth - offsetX;
  const p2ly = seg.p2.y + seg.leftY * halfWidth - offsetY;

  graphics.moveTo(p1lx, p1ly);
  graphics.lineTo(p1rx, p1ry);
  graphics.lineTo(p2rx, p2ry);
  graphics.lineTo(p2lx, p2ly);
  graphics.closePath();
}

/**
 * Draw a semicircle cap
 */
function drawEndCap(
  graphics: PIXI.Graphics,
  center: Point,
  angle: number,
  halfWidth: number,
  isStart: boolean,
  offsetX: number,
  offsetY: number
): void {
  const cx = center.x - offsetX;
  const cy = center.y - offsetY;

  // Left Angle = angle - PI/2
  // Right Angle = angle + PI/2
  // NOTE: Pixi angles: 0=Right, PI/2=Down.
  // "Left" relative to line direction is -90 deg (Top).

  if (isStart) {
    // Start Cap: Convex pointing BACKWARDS
    // Arc from Left (-PI/2) to Right (PI/2) via Back (PI).
    // Anticlockwise: -PI/2 -> PI -> PI/2 ? No.
    // Anticlockwise (Decreasing angle): Left(-PI/2) -> Back(-PI) -> Right(PI/2 is also -3PI/2...)
    // Let's use standard: StartAngle, EndAngle.
    // We want Left -> Right via Back.
    // Left = angle - PI/2. Right = angle + PI/2.
    // Draw Anticlockwise (true).
    graphics.moveTo(
      cx + Math.cos(angle - Math.PI / 2) * halfWidth,
      cy + Math.sin(angle - Math.PI / 2) * halfWidth
    );
    graphics.arc(cx, cy, halfWidth, angle - Math.PI / 2, angle + Math.PI / 2, true);
  } else {
    // End Cap: Convex pointing FORWARDS
    // Arc from Right (PI/2) to Left (-PI/2) via Front (0).
    // Right = angle + PI/2. Left = angle - PI/2.
    // Draw Anticlockwise (true).
    graphics.moveTo(
      cx + Math.cos(angle + Math.PI / 2) * halfWidth,
      cy + Math.sin(angle + Math.PI / 2) * halfWidth
    );
    graphics.arc(cx, cy, halfWidth, angle + Math.PI / 2, angle - Math.PI / 2, true);
  }
}

/**
 * Draw a miter fill quadrilateral (kite)
 */
function drawMiterFill(
  graphics: PIXI.Graphics,
  seg1: SegmentInfo,
  seg2: SegmentInfo,
  centerVertex: Point,
  halfWidth: number,
  offsetX: number,
  offsetY: number
): void {
  const rightTurn = isRightTurn(seg1, seg2);

  // Outer side is LEFT for Right Turn, RIGHT for Left Turn
  const isOuterLeft = rightTurn;

  const nx1 = isOuterLeft ? seg1.leftX : seg1.rightX;
  const ny1 = isOuterLeft ? seg1.leftY : seg1.rightY;

  const nx2 = isOuterLeft ? seg2.leftX : seg2.rightX;
  const ny2 = isOuterLeft ? seg2.leftY : seg2.rightY;

  // Outer points (corners of the segment rects)
  const outer1 = {
    x: centerVertex.x + nx1 * halfWidth,
    y: centerVertex.y + ny1 * halfWidth
  };

  const outer2 = {
    x: centerVertex.x + nx2 * halfWidth,
    y: centerVertex.y + ny2 * halfWidth
  };

  const dir1 = { x: seg1.dirX, y: seg1.dirY };
  const dir2 = { x: seg2.dirX, y: seg2.dirY };

  const miterPoint = lineIntersection(outer1, dir1, outer2, dir2);
  if (!miterPoint) return;

  // Check length
  const dist = Math.sqrt(Math.pow(miterPoint.x - centerVertex.x, 2) + Math.pow(miterPoint.y - centerVertex.y, 2));
  if (dist > halfWidth * MAX_MITER_RATIO) return;

  // Draw Kite: Outer1 -> Miter -> Outer2 -> Center -> Outer1
  graphics.moveTo(outer1.x - offsetX, outer1.y - offsetY);
  graphics.lineTo(miterPoint.x - offsetX, miterPoint.y - offsetY);
  graphics.lineTo(outer2.x - offsetX, outer2.y - offsetY);
  graphics.lineTo(centerVertex.x - offsetX, centerVertex.y - offsetY);
  graphics.closePath();
}

/**
 * Main draw function
 */
export function drawLineWithCornerStyle(
  graphics: PIXI.Graphics,
  points: Point[],
  color: number,
  width: number,
  opacity: number = 1,
  centroid: Point | null = null
): void {
  if (points.length < 1) return;

  const offsetX = centroid?.x ?? 0;
  const offsetY = centroid?.y ?? 0;
  const halfWidth = width / 2;

  graphics.beginPath();

  if (points.length === 1) {
    const p = points[0];
    graphics.circle(p.x - offsetX, p.y - offsetY, halfWidth);
    graphics.fill({ color, alpha: opacity });
    return;
  }

  const segments: SegmentInfo[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push(calculateSegmentInfo(points[i], points[i + 1]));
  }

  // Draw Start Cap
  drawEndCap(graphics, segments[0].p1, segments[0].angle, halfWidth, true, offsetX, offsetY);

  // Draw Segments
  for (const seg of segments) {
    drawSegmentRect(graphics, seg, halfWidth, offsetX, offsetY);
  }

  // Draw End Cap
  const lastSeg = segments[segments.length - 1];
  drawEndCap(graphics, lastSeg.p2, lastSeg.angle, halfWidth, false, offsetX, offsetY);

  // Draw Miters
  for (let i = 0; i < segments.length - 1; i++) {
    const seg1 = segments[i];
    const seg2 = segments[i + 1];
    if (calculateTurnAngle(seg1, seg2) >= MITER_ANGLE_THRESHOLD) {
      drawMiterFill(graphics, seg1, seg2, seg1.p2, halfWidth, offsetX, offsetY);
    }
  }

  graphics.fill({ color, alpha: opacity });
}

/**
 * Create Physics Colliders
 */
export function createLinePhysicsColliders(
  points: Point[],
  centroid: Point,
  body: RAPIER.RigidBody,
  world: RAPIER.World,
  R: typeof RAPIER,
  width: number,
  density: number,
  friction: number,
  restitution: number
): RAPIER.Collider[] {
  const colliders: RAPIER.Collider[] = [];
  const halfWidth = (width / 2) / SCALE;

  if (points.length === 1) {
    const x = (points[0].x - centroid.x) / SCALE;
    const y = -(points[0].y - centroid.y) / SCALE;
    const desc = R.ColliderDesc.ball(halfWidth)
      .setTranslation(x, y)
      .setDensity(density)
      .setCollisionGroups(COLLISION_GROUP.USER_LINE);
    colliders.push(world.createCollider(desc, body));
    return colliders;
  }

  const segments: SegmentInfo[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push(calculateSegmentInfo(points[i], points[i + 1]));
  }

  // Segment Colliders (Cuboids)
  for (const seg of segments) {
    const x1 = (seg.p1.x - centroid.x) / SCALE;
    const y1 = -(seg.p1.y - centroid.y) / SCALE;
    const x2 = (seg.p2.x - centroid.x) / SCALE;
    const y2 = -(seg.p2.y - centroid.y) / SCALE;

    const length = seg.length / SCALE;
    if (length < 0.001) continue;

    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    // Rapier angle: Standard math angle from X axis.
    // Screen angle (seg.angle) is in Y-Down.
    // Physics is Y-Up (flipped).
    // dx is same. dy_phys = -dy_screen.
    // angle_phys = atan2(-dy, dx) = -angle_screen.
    const anglePhys = -seg.angle;

    const desc = R.ColliderDesc.cuboid(length / 2, halfWidth)
      .setTranslation(centerX, centerY)
      .setRotation(anglePhys)
      .setRotation(anglePhys)
      .setDensity(density)
      .setFriction(friction)
      .setRestitution(restitution)
      .setCollisionGroups(COLLISION_GROUP.USER_LINE);

    colliders.push(world.createCollider(desc, body));
  }

  // Vertex Balls (Start and End ONLY)
  // We only want rounded caps at the very ends of the line.
  // Intermediate vertices should NOT have balls, as they would fill the concave gaps
  // that are required for sharp turns (< 30 degrees).
  const endPoints = [points[0], points[points.length - 1]];
  for (const p of endPoints) {
    const x = (p.x - centroid.x) / SCALE;
    const y = -(p.y - centroid.y) / SCALE;
    const desc = R.ColliderDesc.ball(halfWidth)
      .setTranslation(x, y)
      .setDensity(density)
      .setFriction(friction)
      .setRestitution(restitution)
      .setCollisionGroups(COLLISION_GROUP.USER_LINE);
    colliders.push(world.createCollider(desc, body));
  }

  // Miter Colliders (Kite)
  for (let i = 0; i < segments.length - 1; i++) {
    const seg1 = segments[i];
    const seg2 = segments[i + 1];

    if (calculateTurnAngle(seg1, seg2) >= MITER_ANGLE_THRESHOLD) {
      const centerVertex = seg1.p2;
      const rightTurn = isRightTurn(seg1, seg2);
      const isOuterLeft = rightTurn; // Left is Outer for Right(CW) Turn

      const nx1 = isOuterLeft ? seg1.leftX : seg1.rightX;
      const ny1 = isOuterLeft ? seg1.leftY : seg1.rightY;

      const nx2 = isOuterLeft ? seg2.leftX : seg2.rightX;
      const ny2 = isOuterLeft ? seg2.leftY : seg2.rightY;

      // Calculate in Screen Pixels first
      const outer1 = {
        x: centerVertex.x + nx1 * (width / 2),
        y: centerVertex.y + ny1 * (width / 2)
      };

      const outer2 = {
        x: centerVertex.x + nx2 * (width / 2),
        y: centerVertex.y + ny2 * (width / 2)
      };

      const dir1 = { x: seg1.dirX, y: seg1.dirY };
      const dir2 = { x: seg2.dirX, y: seg2.dirY };

      const miterPoint = lineIntersection(outer1, dir1, outer2, dir2);

      if (miterPoint) {
        const dist = Math.sqrt(Math.pow(miterPoint.x - centerVertex.x, 2) + Math.pow(miterPoint.y - centerVertex.y, 2));

        if (dist <= (width / 2) * MAX_MITER_RATIO) {
          // Convert 4 points to Physics Coords
          // outer1, miterPoint, outer2, centerVertex
          const scaleAndFlip = (px: number, py: number) => {
            return [(px - centroid.x) / SCALE, -(py - centroid.y) / SCALE];
          };

          const p1 = scaleAndFlip(outer1.x, outer1.y);
          const p2 = scaleAndFlip(miterPoint.x, miterPoint.y);
          const p3 = scaleAndFlip(outer2.x, outer2.y);
          const p4 = scaleAndFlip(centerVertex.x, centerVertex.y);

          // Check for NaN
          if (
            isNaN(p1[0]) || isNaN(p1[1]) ||
            isNaN(p2[0]) || isNaN(p2[1]) ||
            isNaN(p3[0]) || isNaN(p3[1]) ||
            isNaN(p4[0]) || isNaN(p4[1])
          ) {
            continue;
          }

          const vertices = new Float32Array([
            p1[0], p1[1],
            p2[0], p2[1],
            p3[0], p3[1],
            p4[0], p4[1]
          ]);

          // Use convexHull to create the shape
          const desc = R.ColliderDesc.convexHull(vertices);

          if (desc) {
            desc.setDensity(density)
              .setFriction(friction)
              .setRestitution(restitution)
              .setCollisionGroups(COLLISION_GROUP.USER_LINE);

            try {
              colliders.push(world.createCollider(desc, body));
            } catch {
            }
          }
        }
      }
    }
  }

  return colliders;
}
