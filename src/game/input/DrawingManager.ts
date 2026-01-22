/**
 * Drawing Manager
 * Handles user input for drawing lines
 */

import * as PIXI from 'pixi.js';
import { distanceSampling } from '../utils/douglasPeucker';
import type { Point } from '../utils/douglasPeucker';
import { getScaleFactor, getCanvasWidth, getCanvasHeight } from '../config';
import { drawLineWithCornerStyle } from '../utils/lineRenderer';
import { type Pen, DEFAULT_PEN } from '../data/PenData';

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
  private onDrawingEnd: (() => void) | null = null;
  private onDrawingStart: (() => void) | null = null;
  private collisionProvider: CollisionProvider | null = null;
  private currentPen: Pen = DEFAULT_PEN;

  constructor(stage: PIXI.Container) {
    this.container = new PIXI.Container();
    stage.addChild(this.container);

    // Create preview graphics once and keep it
    this.previewGraphics = new PIXI.Graphics();
    this.container.addChild(this.previewGraphics);
  }

  /**
   * Set the current pen
   */
  setPen(pen: Pen): void {
    this.currentPen = pen;
  }

  /**
   * Enable drawing on the specified container
   */
  enable(interactionArea: PIXI.Container, callback: (points: Point[]) => void, onDrawingEnd?: () => void, onDrawingStart?: () => void): void {
    this.onLineComplete = callback;
    this.onDrawingEnd = onDrawingEnd || null;
    this.onDrawingStart = onDrawingStart || null;

    // Ensure clean state
    this.disable(interactionArea);

    interactionArea.eventMode = 'static';
    interactionArea.cursor = 'crosshair';

    interactionArea.on('pointerdown', this.onPointerDown.bind(this));
    // Use globalpointermove so drawing continues even when pointer moves over UI elements
    interactionArea.on('globalpointermove', this.onPointerMove.bind(this));
    interactionArea.on('pointerup', this.onPointerUp.bind(this));
    interactionArea.on('pointerupoutside', this.onPointerUp.bind(this));
  }

  /**
   * Disable drawing and remove listeners
   */
  disable(interactionArea: PIXI.Container): void {
    if (!interactionArea) return;
    interactionArea.eventMode = 'none'; // Or 'auto'
    interactionArea.cursor = 'default';

    interactionArea.removeAllListeners('pointerdown');
    interactionArea.removeAllListeners('globalpointermove');
    interactionArea.removeAllListeners('pointerup');
    interactionArea.removeAllListeners('pointerupoutside');

    this.cancelDrawing();
  }

  /**
   * Cancel current drawing operation
   */
  cancelDrawing(): void {
    this.isDrawing = false;
    this.isValidStart = false;

    // Clear preview graphics
    this.previewGraphics.clear();

    // Destroy current line graphics
    if (this.currentGraphics) {
      this.container.removeChild(this.currentGraphics);
      this.currentGraphics.destroy();
      this.currentGraphics = null;
    }

    this.currentPoints = [];
  }

  /**
   * Handle pointer down event
   */
  private onPointerDown(event: PIXI.FederatedPointerEvent): void {
    // Cancel any existing drawing first
    this.cancelDrawing();

    // Clamp pointer to canvas bounds so drawing continues to the nearest edge
    const scaleFactor = getScaleFactor();
    const canvasW = getCanvasWidth();
    const canvasH = getCanvasHeight();

    const clampedGlobalX = Math.min(Math.max(event.globalX, 0), canvasW);
    const clampedGlobalY = Math.min(Math.max(event.globalY, 0), canvasH);

    const startPoint = {
      x: clampedGlobalX / scaleFactor,
      y: clampedGlobalY / scaleFactor
    };

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

    // Notify start of drawing
    if (this.onDrawingStart) {
      this.onDrawingStart();
    }
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

    // Clamp pointer to canvas bounds so when cursor leaves the window
    // the drawing continues toward the nearest edge instead of using
    // out-of-bounds coordinates.
    const scaleFactor = getScaleFactor();
    const canvasW = getCanvasWidth();
    const canvasH = getCanvasHeight();

    const clampedGlobalX = Math.min(Math.max(event.globalX, 0), canvasW);
    const clampedGlobalY = Math.min(Math.max(event.globalY, 0), canvasH);

    const point = {
      x: clampedGlobalX / scaleFactor,
      y: clampedGlobalY / scaleFactor
    };

    // Only add point if it's far enough from the last point
    const lastPoint = this.currentPoints[this.currentPoints.length - 1];

    // If invalid start, check if the ORIGINAL start point has become valid
    // (e.g., the obstacle covering it moved away)
    if (!this.isValidStart) {
      const startPoint = this.currentPoints[0];
      if (this.collisionProvider && this.collisionProvider.isPointValid(startPoint)) {
        // Start point is now valid! Unlock drawing.
        this.isValidStart = true;
        // Proceed to process the current move event (fall through)
      } else {
        // Still invalid, just show visual indication
        this.redrawCurrentLine(point);
        return;
      }
    }

    // Check for collision
    if (this.collisionProvider) {
      const intersection = this.collisionProvider.getIntersection(lastPoint, point);

      if (intersection) {
        const dx = intersection.x - lastPoint.x;
        const dy = intersection.y - lastPoint.y;
        const distToIntersect = Math.sqrt(dx * dx + dy * dy);

        // If the segment to the intersection point is long enough, add it
        // Note: No offset needed because shape cast (with current pen width radius) already
        // ensures the entire line segment maintains proper distance from obstacles
        if (distToIntersect >= this.currentPen.minDistance) {
          this.currentPoints.push(intersection);
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

    if (distance >= this.currentPen.minDistance) {
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
      const simplifiedPoints = distanceSampling(this.currentPoints, this.currentPen.minDistance);

      // Need at least 1 point after simplification (single point = dot)
      if (simplifiedPoints.length >= 1 && this.onLineComplete) {
        this.onLineComplete(simplifiedPoints);
      }
    }

    // Notify that drawing attempt has ended (regardless of whether a line was created)
    if (this.onDrawingEnd) {
      this.onDrawingEnd();
    }

    this.currentPoints = [];
  }

  /**
   * Redraw the current line preview with custom corner styles
   */
  private redrawCurrentLine(cursorPoint?: Point): void {
    if (!this.currentGraphics || this.currentPoints.length < 1) return;
    const scaleFactor = getScaleFactor();

    this.currentGraphics.clear();

    // Draw main committed line using custom corner styles
    if (this.currentPoints.length >= 1 && this.isValidStart) {
      // Map points to screen coordinates for rendering
      const screenPoints = this.currentPoints.map(p => ({
        x: p.x * scaleFactor,
        y: p.y * scaleFactor
      }));

      drawLineWithCornerStyle(
        this.currentGraphics,
        screenPoints,
        this.currentPen.color,
        this.currentPen.width * scaleFactor,
        this.currentPen.opacity,
        null
      );
    }

    // Draw ghost line to cursor using the separate preview graphics
    if (cursorPoint) {
      this.previewGraphics.clear();

      const lastPoint = this.currentPoints[this.currentPoints.length - 1];
      const dx = cursorPoint.x - lastPoint.x;
      const dy = cursorPoint.y - lastPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance >= this.currentPen.minDistance) {
        // For preview, use simple stroke style
        const scaleFactor = getScaleFactor();
        this.previewGraphics.setStrokeStyle({
          width: this.currentPen.width * scaleFactor,
          color: this.currentPen.color,
          cap: 'round',
          join: 'round',
          alpha: 0.4,
        });

        this.previewGraphics.moveTo(lastPoint.x * scaleFactor, lastPoint.y * scaleFactor);
        this.previewGraphics.lineTo(cursorPoint.x * scaleFactor, cursorPoint.y * scaleFactor);
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
