/**
 * Drawing Manager
 * Handles user input for drawing lines
 */

import * as PIXI from 'pixi.js';
import { distanceSampling } from '../utils/douglasPeucker';
import type { Point } from '../utils/douglasPeucker';
import { LINE_COLOR, LINE_WIDTH, LINE_MIN_DISTANCE } from '../config';

export interface CollisionProvider {
  isPointValid(point: Point): boolean;
  getIntersection(p1: Point, p2: Point): Point | null;
}

export class DrawingManager {
  private container: PIXI.Container;
  private currentGraphics: PIXI.Graphics | null = null;
  private previewGraphics: PIXI.Graphics;
  private currentPoints: Point[] = [];
  private isDrawing = false;
  private isValidStart = false;
  private onLineComplete: ((points: Point[]) => void) | null = null;
  private collisionProvider: CollisionProvider | null = null;

  constructor(stage: PIXI.Container) {
    this.container = new PIXI.Container();
    stage.addChild(this.container);

    // Create preview graphics once and keep it
    this.previewGraphics = new PIXI.Graphics();
    this.container.addChild(this.previewGraphics);
  }

  /**
   * Enable drawing on the specified container
   */
  enable(interactionArea: PIXI.Container, callback: (points: Point[]) => void): void {
    this.onLineComplete = callback;

    interactionArea.eventMode = 'static';
    interactionArea.cursor = 'crosshair';

    interactionArea.on('pointerdown', this.onPointerDown.bind(this));
    interactionArea.on('pointermove', this.onPointerMove.bind(this));
    interactionArea.on('pointerup', this.onPointerUp.bind(this));
    interactionArea.on('pointerupoutside', this.onPointerUp.bind(this));
  }

  /**
   * Handle pointer down event
   */
  private onPointerDown(event: PIXI.FederatedPointerEvent): void {
    const startPoint = { x: event.globalX, y: event.globalY };

    // Check if starting point is valid
    this.isValidStart = this.collisionProvider ? this.collisionProvider.isPointValid(startPoint) : true;

    this.isDrawing = true;
    this.currentPoints = [];

    // Create new graphics for drawing
    this.currentGraphics = new PIXI.Graphics();
    this.container.addChild(this.currentGraphics);

    // Ensure preview graphics is always on top
    this.container.addChild(this.previewGraphics);

    // Add first point
    this.currentPoints.push(startPoint);
  }

  /**
   * Handle pointer move event
   */
  /**
   * Set collision provider
   */
  setCollisionProvider(provider: CollisionProvider): void {
    this.collisionProvider = provider;
  }

  /**
   * Handle pointer move event
   */
  private onPointerMove(event: PIXI.FederatedPointerEvent): void {
    if (!this.isDrawing || !this.currentGraphics) return;

    const point = { x: event.globalX, y: event.globalY };

    // Only add point if it's far enough from the last point
    const lastPoint = this.currentPoints[this.currentPoints.length - 1];

    // If invalid start, we just want to show the specific visual (ghost line + start point)
    // We do NOT add points to the line.
    if (!this.isValidStart) {
      this.redrawCurrentLine(point);
      return;
    }

    // Check for collision
    if (this.collisionProvider) {
      const intersection = this.collisionProvider.getIntersection(lastPoint, point);

      if (intersection) {
        const dx = intersection.x - lastPoint.x;
        const dy = intersection.y - lastPoint.y;
        const distToIntersect = Math.sqrt(dx * dx + dy * dy);

        // If the segment to the wall is long enough, add it
        if (distToIntersect >= LINE_MIN_DISTANCE) {
          // Offset slightly back to avoid sticking to the object
          const offset = 3.0;
          if (distToIntersect > offset) {
            const t = (distToIntersect - offset) / distToIntersect;
            const newX = lastPoint.x + dx * t;
            const newY = lastPoint.y + dy * t;
            this.currentPoints.push({ x: newX, y: newY });
          }
        }

        // We hit something, so we stop here. 
        // We redraw the confirmed line AND the ghost line to the cursor so the user sees where they are pointing
        this.redrawCurrentLine(point);
        return;
      }
    }

    const dx = point.x - lastPoint.x;
    const dy = point.y - lastPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance >= LINE_MIN_DISTANCE) {
      this.currentPoints.push(point);
    }

    // Always redraw to show the ghost line to current cursor
    this.redrawCurrentLine(point);
  }

  /**
   * Handle pointer up event
   */
  private onPointerUp(): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    // Clear preview graphics
    this.previewGraphics.clear();

    if (this.currentGraphics) {
      // Don't destroy immediately if we want to keep the line
      // But Game.ts creates a DrawnLine which creates NEW graphics.
      // So we can destroy these temporary graphics.
      this.container.removeChild(this.currentGraphics);
      this.currentGraphics.destroy();
      this.currentGraphics = null;
    }

    // Need at least 1 point to create a line (or dot), AND must be a valid start
    if (this.currentPoints.length >= 1 && this.isValidStart) {
      // Simplify the line using only distance sampling, NO Douglas-Peucker
      // This ensures the physics shape matches the visual preview (which was distance thresholded)
      const simplifiedPoints = distanceSampling(this.currentPoints, LINE_MIN_DISTANCE);

      // Need at least 1 point after simplification (single point = dot)
      if (simplifiedPoints.length >= 1 && this.onLineComplete) {
        this.onLineComplete(simplifiedPoints);
      }
    }

    this.currentPoints = [];
  }

  /**
   * Redraw the current line preview
   */
  private redrawCurrentLine(cursorPoint?: Point): void {
    if (!this.currentGraphics || this.currentPoints.length < 1) return;

    this.currentGraphics.clear();

    // Draw main committed line
    if (this.currentPoints.length >= 2) {
      this.currentGraphics.setStrokeStyle({
        width: LINE_WIDTH,
        color: LINE_COLOR,
        cap: 'round',
        join: 'round',
        alpha: 1.0, // Fully opaque to match final line
      });

      const startPoint = this.currentPoints[0];
      this.currentGraphics.moveTo(startPoint.x, startPoint.y);

      for (let i = 1; i < this.currentPoints.length; i++) {
        const point = this.currentPoints[i];
        this.currentGraphics.lineTo(point.x, point.y);
      }
      this.currentGraphics.stroke();
    } else if (this.currentPoints.length === 1 && this.isValidStart) {
      // Draw single point only if start is valid
      const p = this.currentPoints[0];
      this.currentGraphics.circle(p.x, p.y, LINE_WIDTH / 2);
      this.currentGraphics.fill(LINE_COLOR);
    }

    // Draw ghost line to cursor using the separate preview graphics
    if (cursorPoint) {
      this.previewGraphics.clear();

      const lastPoint = this.currentPoints[this.currentPoints.length - 1];
      const dx = cursorPoint.x - lastPoint.x;
      const dy = cursorPoint.y - lastPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance >= LINE_MIN_DISTANCE) {
        this.previewGraphics.setStrokeStyle({
          width: LINE_WIDTH,
          color: LINE_COLOR,
          cap: 'round',
          join: 'round',
          alpha: 0.4, // Semi-transparent for ghost segment
        });

        this.previewGraphics.moveTo(lastPoint.x, lastPoint.y);
        this.previewGraphics.lineTo(cursorPoint.x, cursorPoint.y);
        this.previewGraphics.stroke();
      }
    }
  }

  /**
   * Get the drawing container
   */
  getContainer(): PIXI.Container {
    return this.container;
  }
}
