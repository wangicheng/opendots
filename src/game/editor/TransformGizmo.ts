/**
 * TransformGizmo
 * Provides visual handles for moving, rotating, and scaling/reshaping objects in the level editor.
 * Designed for both desktop (mouse) and mobile (touch) input.
 */

import * as PIXI from 'pixi.js';
import { scale, getScaleFactor, CONVEYOR_BELT_HEIGHT, BALL_RADIUS } from '../config';

// Handle Types
export type HandleType =
  | 'move'
  | 'rotate'
  | 'scale_tl' | 'scale_tr' | 'scale_bl' | 'scale_br'  // Corners
  | 'scale_t' | 'scale_b' | 'scale_l' | 'scale_r'      // Edges
  | 'vertex_0' | 'vertex_1' | 'vertex_2'               // Triangle/C-shape vertices
  | 'endpoint_start' | 'endpoint_end';                  // Laser endpoints

// Object constraints based on type
export interface TransformConstraints {
  canMove: boolean;
  canRotate: boolean;
  canScaleWidth: boolean;
  canScaleHeight: boolean;
  canScaleUniform: boolean;
  canEditVertices: boolean;  // For triangles/c-shapes
  canEditEndpoints: boolean; // For lasers
  vertexCount?: number;      // Number of editable vertices
}

// Gizmo configuration based on object type
const CONSTRAINTS: Record<string, TransformConstraints> = {
  'ball_blue': { canMove: true, canRotate: false, canScaleWidth: false, canScaleHeight: false, canScaleUniform: false, canEditVertices: false, canEditEndpoints: false },
  'ball_pink': { canMove: true, canRotate: false, canScaleWidth: false, canScaleHeight: false, canScaleUniform: false, canEditVertices: false, canEditEndpoints: false },
  'button': { canMove: true, canRotate: true, canScaleWidth: false, canScaleHeight: false, canScaleUniform: false, canEditVertices: false, canEditEndpoints: false },
  'obstacle_circle': { canMove: true, canRotate: false, canScaleWidth: false, canScaleHeight: false, canScaleUniform: true, canEditVertices: false, canEditEndpoints: false },
  'obstacle_rectangle': { canMove: true, canRotate: true, canScaleWidth: true, canScaleHeight: true, canScaleUniform: false, canEditVertices: false, canEditEndpoints: false },
  'obstacle_triangle': { canMove: true, canRotate: true, canScaleWidth: false, canScaleHeight: false, canScaleUniform: false, canEditVertices: true, canEditEndpoints: false, vertexCount: 3 },
  'obstacle_c_shape': { canMove: true, canRotate: false, canScaleWidth: false, canScaleHeight: false, canScaleUniform: false, canEditVertices: true, canEditEndpoints: false, vertexCount: 3 },
  'obstacle_bezier': { canMove: true, canRotate: false, canScaleWidth: false, canScaleHeight: false, canScaleUniform: false, canEditVertices: true, canEditEndpoints: false, vertexCount: 3 },
  'falling_circle': { canMove: true, canRotate: false, canScaleWidth: false, canScaleHeight: false, canScaleUniform: true, canEditVertices: false, canEditEndpoints: false },
  'falling_rectangle': { canMove: true, canRotate: true, canScaleWidth: true, canScaleHeight: true, canScaleUniform: false, canEditVertices: false, canEditEndpoints: false },
  'falling_triangle': { canMove: true, canRotate: true, canScaleWidth: false, canScaleHeight: false, canScaleUniform: false, canEditVertices: true, canEditEndpoints: false, vertexCount: 3 },
  'net': { canMove: true, canRotate: true, canScaleWidth: true, canScaleHeight: true, canScaleUniform: false, canEditVertices: false, canEditEndpoints: false },
  'ice': { canMove: true, canRotate: true, canScaleWidth: true, canScaleHeight: true, canScaleUniform: false, canEditVertices: false, canEditEndpoints: false },
  'seesaw': { canMove: true, canRotate: true, canScaleWidth: true, canScaleHeight: true, canScaleUniform: false, canEditVertices: false, canEditEndpoints: false },
  'laser': { canMove: true, canRotate: false, canScaleWidth: false, canScaleHeight: false, canScaleUniform: false, canEditVertices: false, canEditEndpoints: true },
  'conveyor': { canMove: true, canRotate: true, canScaleWidth: true, canScaleHeight: false, canScaleUniform: false, canEditVertices: false, canEditEndpoints: false },
};

// Visual constants
const HANDLE_RADIUS = 5;
const HANDLE_COLOR = 0x2196F3; // Blue
const ROTATE_HANDLE_OFFSET = 40;
const ROTATE_HANDLE_COLOR = 0x4CAF50; // Green
const BOUNDING_BOX_COLOR = 0x2196F3;
const BOUNDING_BOX_ALPHA = 0.5;
const MIN_SIZE = 20;

export class TransformGizmo extends PIXI.Container {
  private targetContainer: PIXI.Container | null = null;
  private targetData: any = null;
  private targetType: string = '';
  private constraints: TransformConstraints | null = null;

  private boundingBox: PIXI.Graphics;
  private handles: Map<HandleType, PIXI.Graphics> = new Map();
  private rotateHandle: PIXI.Graphics | null = null;

  // Drag State
  private isDragging: boolean = false;
  private activeHandle: HandleType | null = null;
  private dragStartGlobal: { x: number, y: number } = { x: 0, y: 0 };
  private initialData: any = null;
  private initialContainerPos: { x: number, y: number } = { x: 0, y: 0 };
  private initialContainerRotation: number = 0;
  private initialMouseAngle: number = 0;

  // Callbacks
  private onTransformChange: (() => void) | null = null;
  private onTransformEnd: (() => void) | null = null;
  private onDragStart: (() => void) | null = null;
  private onDragEnd: (() => void) | null = null;
  private onContentClick: (() => void) | null = null;

  // Interaction State
  private hasMoved: boolean = false;
  private isExternalStart: boolean = false;

  constructor() {
    super();
    this.boundingBox = new PIXI.Graphics();
    this.addChild(this.boundingBox);
    this.eventMode = 'static';
    this.interactiveChildren = true;
  }

  /**
   * Get constraints key from type and data
   */
  private getConstraintKey(type: string, data: any): string {
    if (type === 'obstacle' || type === 'falling') {
      const subType = data.type || 'rectangle';
      return `${type}_${subType}`;
    }
    return type;
  }

  /**
   * Attach the gizmo to a target object
   */
  public setTarget(
    container: PIXI.Container,
    data: any,
    type: string,
    onTransformChange?: () => void,
    onTransformEnd?: () => void,
    onContentClick?: () => void,
    onDragStart?: () => void,
    onDragEnd?: () => void
  ): void {
    this.clearHandles();

    this.targetContainer = container;
    this.targetData = data;
    this.targetType = type;
    this.onTransformChange = onTransformChange || null;
    this.onTransformEnd = onTransformEnd || null;
    this.onContentClick = onContentClick || null;
    this.onDragStart = onDragStart || null;
    this.onDragEnd = onDragEnd || null;

    const constraintKey = this.getConstraintKey(type, data);
    this.constraints = CONSTRAINTS[constraintKey] || {
      canMove: true,
      canRotate: true,
      canScaleWidth: true,
      canScaleHeight: true,
      canScaleUniform: false,
      canEditVertices: false,
      canEditEndpoints: false
    };

    this.createHandles();
    this.updateGizmo();
    this.visible = true;
  }

  /**
   * Clear the current target
   */
  public clearTarget(): void {
    this.targetContainer = null;
    this.targetData = null;
    this.targetType = '';
    this.constraints = null;
    this.clearHandles();
    this.visible = false;
  }

  private clearHandles(): void {
    this.handles.forEach(h => {
      h.removeAllListeners();
      h.destroy();
    });
    this.handles.clear();
    if (this.rotateHandle) {
      this.rotateHandle.removeAllListeners();
      this.rotateHandle.destroy();
      this.rotateHandle = null;
    }
    this.boundingBox.clear();
  }

  /**
   * Create visual handles based on constraints
   */
  private createHandles(): void {
    if (!this.constraints || !this.targetData) return;

    const c = this.constraints;

    // Create Move Handle (center)
    if (c.canMove) {
      // Move is implicit - dragging the bounding box moves the object
      // No dedicated handle needed, but we set up interaction on bounding box
    }

    // Create Rotation Handle (top)
    if (c.canRotate) {
      this.rotateHandle = this.createHandle('rotate', ROTATE_HANDLE_COLOR);
      this.addChild(this.rotateHandle);
    }

    // Create Scale Handles
    if (c.canScaleWidth && c.canScaleHeight) {
      // Corner handles for free scaling
      this.createAndAddHandle('scale_tl', HANDLE_COLOR);
      this.createAndAddHandle('scale_tr', HANDLE_COLOR);
      this.createAndAddHandle('scale_bl', HANDLE_COLOR);
      this.createAndAddHandle('scale_br', HANDLE_COLOR);
      // Edge handles for single-axis scaling
      this.createAndAddHandle('scale_t', HANDLE_COLOR);
      this.createAndAddHandle('scale_b', HANDLE_COLOR);
      this.createAndAddHandle('scale_l', HANDLE_COLOR);
      this.createAndAddHandle('scale_r', HANDLE_COLOR);
    } else if (c.canScaleWidth) {
      // Width only (e.g., Conveyor)
      this.createAndAddHandle('scale_l', HANDLE_COLOR);
      this.createAndAddHandle('scale_r', HANDLE_COLOR);
    } else if (c.canScaleHeight) {
      // Height only
      this.createAndAddHandle('scale_t', HANDLE_COLOR);
      this.createAndAddHandle('scale_b', HANDLE_COLOR);
    } else if (c.canScaleUniform) {
      // Uniform scaling (circle radius)
      this.createAndAddHandle('scale_t', HANDLE_COLOR);
      this.createAndAddHandle('scale_b', HANDLE_COLOR);
      this.createAndAddHandle('scale_l', HANDLE_COLOR);
      this.createAndAddHandle('scale_r', HANDLE_COLOR);
    }

    // Create Vertex Handles (Triangle, C-Shape)
    if (c.canEditVertices && c.vertexCount) {
      for (let i = 0; i < c.vertexCount; i++) {
        this.createAndAddHandle(`vertex_${i}` as HandleType, HANDLE_COLOR);
      }
    }

    // Create Endpoint Handles (Laser)
    if (c.canEditEndpoints) {
      this.createAndAddHandle('endpoint_start', HANDLE_COLOR);
      this.createAndAddHandle('endpoint_end', HANDLE_COLOR);
    }
  }

  private createAndAddHandle(type: HandleType, color: number): void {
    const handle = this.createHandle(type, color);
    this.handles.set(type, handle);
    this.addChild(handle);
  }

  private createHandle(type: HandleType, color: number): PIXI.Graphics {
    const g = new PIXI.Graphics();
    const r = scale(HANDLE_RADIUS);

    const strokeWidth = 2;
    // Make visual slightly smaller than hit area (r) to feel more precise
    const visualRadius = r - 1;

    if (type === 'rotate') {
      // Rotate handle: Solid colored circle with white border
      g.circle(0, 0, visualRadius);
      // Use color (Green) for fill
      g.fill({ color });
      g.stroke({ width: strokeWidth, color: 0xFFFFFF });
    } else if (type.startsWith('vertex') || type.startsWith('endpoint')) {
      // Vertex/Endpoint: Solid colored circle with white border
      g.circle(0, 0, visualRadius);
      // Use color (Blue) for fill
      g.fill({ color });
      g.stroke({ width: strokeWidth, color: 0xFFFFFF });
    } else {
      // Scale handles: White circle with colored border
      g.circle(0, 0, visualRadius);
      g.fill({ color: 0xFFFFFF });
      g.stroke({ width: strokeWidth, color: color });
    }

    g.eventMode = 'static';
    g.cursor = this.getCursorForHandle(type);

    g.on('pointerdown', (e: PIXI.FederatedPointerEvent) => this.onHandleDown(type, e));

    return g;
  }

  private getCursorForHandle(type: HandleType): string {
    switch (type) {
      case 'rotate': return 'grab';
      case 'scale_tl': case 'scale_br': return 'nwse-resize';
      case 'scale_tr': case 'scale_bl': return 'nesw-resize';
      case 'scale_t': case 'scale_b': return 'ns-resize';
      case 'scale_l': case 'scale_r': return 'ew-resize';
      default: return 'move';
    }
  }

  /**
   * Update gizmo visuals to match target's current state
   */
  public updateGizmo(): void {
    if (!this.targetContainer || !this.targetData || !this.constraints) return;

    const scaleFactor = getScaleFactor();
    const data = this.targetData;
    const type = this.targetType;

    // Clear previous bounding box
    this.boundingBox.clear();

    // Get object dimensions in design space
    let width = 0, height = 0, radius = 0;
    let points: { x: number, y: number }[] | undefined;
    let x1 = 0, y1 = 0, x2 = 0, y2 = 0; // For laser

    if (type === 'laser') {
      x1 = data.x1;
      y1 = data.y1;
      x2 = data.x2;
      y2 = data.y2;
      width = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      height = 20; // Standard laser height
    } else if (type === 'ball_blue' || type === 'ball_pink') {
      radius = BALL_RADIUS;
      width = height = radius * 2;
    } else if (type === 'conveyor') {
      width = data.width || 300;
      height = CONVEYOR_BELT_HEIGHT;
    } else if (type === 'button') {
      width = 32;
      height = 40;
    } else if (data.type === 'circle') {
      radius = data.radius || data.width / 2 || 50;
      width = height = radius * 2;
    } else if (data.type === 'triangle' || data.type === 'c_shape' || data.type === 'bezier') {
      points = data.points;
      if (points && points.length >= 3) {
        // Calculate bounding box of points
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        width = maxX - minX;
        height = maxY - minY;
      }
    } else {
      width = data.width || 100;
      height = data.height || 100;
    }

    // Position gizmo at target
    if (type === 'laser') {
      this.position.set(
        ((x1 + x2) / 2) * scaleFactor,
        ((y1 + y2) / 2) * scaleFactor
      );
      this.rotation = Math.atan2(y2 - y1, x2 - x1);
    } else {
      this.position.set(
        this.targetContainer.position.x,
        this.targetContainer.position.y
      );
      this.rotation = this.targetContainer.rotation;
    }
    this.scale.set(scaleFactor);

    // Draw bounding box
    const hw = width / 2, hh = height / 2;

    if (radius > 0 && !points) {
      // Circle bounding
      this.boundingBox.circle(0, 0, radius);
    } else if (points && (data.type === 'triangle')) {
      // Polygon bounding
      const flatPoints = points.flatMap(p => [p.x, p.y]);
      this.boundingBox.poly(flatPoints);
    } else if (points && (data.type === 'c_shape' || data.type === 'bezier')) {
      // C-shape/Bezier - prefer shape-accurate hit area for Bezier, keep rect for C-shape
      if (data.type === 'bezier' && data.thickness) {
        // Approximate the stroked bezier as a polygon by sampling the curve
        const p0 = points[0];
        const p1 = points[1];
        const p2 = points[2];
        const cpX = 2 * p1.x - 0.5 * p0.x - 0.5 * p2.x;
        const cpY = 2 * p1.y - 0.5 * p0.y - 0.5 * p2.y;

        const thickness = data.thickness || 20;
        const half = thickness / 2;
        const segments = 20;

        // Use arrays of point pairs so reversing keeps x/y together
        const leftPts: { x: number; y: number }[] = [];
        const rightPts: { x: number; y: number }[] = [];

        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const omt = 1 - t;
          const x = omt * omt * p0.x + 2 * omt * t * cpX + t * t * p2.x;
          const y = omt * omt * p0.y + 2 * omt * t * cpY + t * t * p2.y;

          // derivative for tangent
          const dx = 2 * omt * (cpX - p0.x) + 2 * t * (p2.x - cpX);
          const dy = 2 * omt * (cpY - p0.y) + 2 * t * (p2.y - cpY);
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;

          leftPts.push({ x: x + nx * half, y: y + ny * half });
          rightPts.push({ x: x - nx * half, y: y - ny * half });
        }

        // Build flat coordinate array: left side forward, right side reversed
        const poly: number[] = [];
        for (const p of leftPts) poly.push(p.x, p.y);
        for (let i = rightPts.length - 1; i >= 0; i--) {
          poly.push(rightPts[i].x, rightPts[i].y);
        }

        // Draw polygon and use it as the clickable area
        this.boundingBox.poly(poly);
      } else if (data.type === 'c_shape' && data.points && data.points.length === 3) {
        // C-shape: Draw arc
        const p1 = points[0];
        const p2 = points[1];
        const p3 = points[2];
        const x1 = p1.x, y1 = p1.y;
        const x2 = p2.x, y2 = p2.y;
        const x3 = p3.x, y3 = p3.y;

        const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
        if (Math.abs(D) > 0.001) {
          const centerX = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / D;
          const centerY = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / D;
          const arcRadius = Math.sqrt(Math.pow(x1 - centerX, 2) + Math.pow(y1 - centerY, 2));
          let angle1 = Math.atan2(y1 - centerY, x1 - centerX);
          let angle2 = Math.atan2(y2 - centerY, x2 - centerX);
          let angle3 = Math.atan2(y3 - centerY, x3 - centerX);
          const normalize = (a: number) => (a + 2 * Math.PI) % (2 * Math.PI);
          const isCCW = normalize(angle2 - angle1) < normalize(angle3 - angle1);

          this.boundingBox.arc(centerX, centerY, arcRadius, angle1, angle3, !isCCW);
        } else {
          // Collinear fallback
          const xs = points.map(p => p.x);
          const ys = points.map(p => p.y);
          const minX = Math.min(...xs), maxX = Math.max(...xs);
          const minY = Math.min(...ys), maxY = Math.max(...ys);
          this.boundingBox.rect(minX, minY, maxX - minX, maxY - minY);
        }
      } else {
        // Fallback: draw rectangular hit area around points
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        this.boundingBox.rect(minX, minY, maxX - minX, maxY - minY);
      }
    } else if (type === 'conveyor') {
      // Conveyor bounding (Pill shape)
      const r = CONVEYOR_BELT_HEIGHT / 2;
      const w = width; // width passed from logic above
      this.boundingBox.moveTo(-w / 2, -r);
      this.boundingBox.lineTo(w / 2, -r);
      this.boundingBox.arc(w / 2, 0, r, -Math.PI / 2, Math.PI / 2);
      this.boundingBox.lineTo(-w / 2, r);
      this.boundingBox.arc(-w / 2, 0, r, Math.PI / 2, -Math.PI / 2);
      this.boundingBox.closePath();
    } else {
      // Rectangle bounding
      this.boundingBox.rect(-hw, -hh, width, height);
    }

    // Fill with transparent color to make interior clickable, then stroke outline
    this.boundingBox.fill({ color: 0xFFFFFF, alpha: 0.001 });
    this.boundingBox.stroke({ color: BOUNDING_BOX_COLOR, width: 2, alpha: BOUNDING_BOX_ALPHA });

    // Enable move interaction on bounding box
    this.boundingBox.eventMode = 'static';
    this.boundingBox.cursor = 'move';
    this.boundingBox.removeAllListeners();
    this.boundingBox.on('pointerdown', (e: PIXI.FederatedPointerEvent) => this.onHandleDown('move', e));

    // Position handles
    this.positionHandles(width, height, radius, points, x1, y1, x2, y2);
  }

  private positionHandles(
    width: number, height: number, _radius: number,
    points?: { x: number, y: number }[],
    x1?: number, y1?: number, x2?: number, y2?: number
  ): void {
    const hw = width / 2, hh = height / 2;

    // Rotate handle position
    if (this.rotateHandle) {
      const offset = scale(ROTATE_HANDLE_OFFSET) / getScaleFactor();
      this.rotateHandle.position.set(0, -hh - offset);
    }

    // Corner handles
    this.positionHandle('scale_tl', -hw, -hh);
    this.positionHandle('scale_tr', hw, -hh);
    this.positionHandle('scale_bl', -hw, hh);
    this.positionHandle('scale_br', hw, hh);

    // Edge handles
    this.positionHandle('scale_t', 0, -hh);
    this.positionHandle('scale_b', 0, hh);
    this.positionHandle('scale_l', -hw, 0);
    this.positionHandle('scale_r', hw, 0);

    // Vertex handles
    if (points) {
      for (let i = 0; i < points.length && i < 3; i++) {
        this.positionHandle(`vertex_${i}` as HandleType, points[i].x, points[i].y);
      }
    }

    // Endpoint handles (for laser)
    if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
      // In local space (gizmo is at center with rotation matching laser angle)
      const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      this.positionHandle('endpoint_start', -len / 2, 0);
      this.positionHandle('endpoint_end', len / 2, 0);
    }
  }

  private positionHandle(type: HandleType, x: number, y: number): void {
    const handle = this.handles.get(type);
    if (handle) {
      handle.position.set(x, y);
    }
  }

  // ---- Interaction Handlers ----

  private onHandleDown(handleType: HandleType, e: PIXI.FederatedPointerEvent): void {
    if (!this.targetContainer || !this.targetData) return;

    e.stopPropagation();
    this.isDragging = true;
    this.activeHandle = handleType;
    // Use nativeEvent coordinates to match onPointerMove which uses native PointerEvent
    this.dragStartGlobal = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
    this.hasMoved = false;
    this.isExternalStart = false;

    // Deep clone initial data
    this.initialData = JSON.parse(JSON.stringify(this.targetData));
    this.initialContainerPos = {
      x: this.targetContainer.position.x,
      y: this.targetContainer.position.y
    };
    this.initialContainerRotation = this.targetContainer.rotation;

    // Limit global listener to window
    const doc = window;

    if (handleType === 'rotate') {
      const globalPos = this.targetContainer.getGlobalPosition();
      this.initialMouseAngle = Math.atan2(e.nativeEvent.clientY - globalPos.y, e.nativeEvent.clientX - globalPos.x);
    }

    doc.addEventListener('pointermove', this.onPointerMove);
    doc.addEventListener('pointerup', this.onPointerUp);
    doc.addEventListener('pointercancel', this.onPointerUp);

    this.onDragStart?.();
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDragging || !this.activeHandle || !this.targetData || !this.targetContainer) return;

    // Check for movement threshold
    if (!this.hasMoved) {
      const dist = Math.hypot(e.clientX - this.dragStartGlobal.x, e.clientY - this.dragStartGlobal.y);
      if (dist > 5) {
        this.hasMoved = true;
      }
    }

    const scaleFactor = getScaleFactor();
    const dx = (e.clientX - this.dragStartGlobal.x) / scaleFactor;
    const dy = (e.clientY - this.dragStartGlobal.y) / scaleFactor;

    switch (this.activeHandle) {
      case 'move':
        this.handleMove(dx, dy);
        break;
      case 'rotate':
        this.handleRotate(e.clientX, e.clientY);
        break;
      case 'scale_tl':
      case 'scale_tr':
      case 'scale_bl':
      case 'scale_br':
      case 'scale_t':
      case 'scale_b':
      case 'scale_l':
      case 'scale_r':
        this.handleScale(this.activeHandle, dx, dy);
        break;
      default:
        if (this.activeHandle.startsWith('vertex_')) {
          const idx = parseInt(this.activeHandle.split('_')[1]);
          this.handleVertexMove(idx, dx, dy);
        } else if (this.activeHandle.startsWith('endpoint_')) {
          this.handleEndpointMove(this.activeHandle, dx, dy);
        }
    }

    this.updateGizmo();
    this.onTransformChange?.();
  };

  private onPointerUp = (): void => {
    this.isDragging = false;
    if (!this.hasMoved && this.activeHandle === 'move' && !this.isExternalStart) {
      this.onContentClick?.();
    }

    this.activeHandle = null;
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);

    this.onTransformEnd?.();
    this.onDragEnd?.();
  };

  // ---- Transform Operations ----

  private handleMove(dx: number, dy: number): void {
    const data = this.targetData;
    const type = this.targetType;

    if (type === 'laser') {
      data.x1 = this.initialData.x1 + dx;
      data.y1 = this.initialData.y1 + dy;
      data.x2 = this.initialData.x2 + dx;
      data.y2 = this.initialData.y2 + dy;
    } else {
      data.x = this.initialData.x + dx;
      data.y = this.initialData.y + dy;
    }

    // Update visual position
    const scaleFactor = getScaleFactor();
    this.targetContainer!.position.set(
      this.initialContainerPos.x + dx * scaleFactor,
      this.initialContainerPos.y + dy * scaleFactor
    );
  }

  private handleRotate(clientX: number, clientY: number): void {
    if (!this.targetContainer || !this.parent) return;

    // Get center in global space
    const globalPos = this.targetContainer.getGlobalPosition();

    // Calculate current angle from center to mouse
    const currentMouseAngle = Math.atan2(clientY - globalPos.y, clientX - globalPos.x);

    // Calculate delta from initial mouse angle
    const deltaAngle = currentMouseAngle - this.initialMouseAngle;

    // Apply delta to initial rotation
    const rotationRad = this.initialContainerRotation + deltaAngle;

    // Apply to data (in degrees)
    const rotationDeg = (rotationRad * 180) / Math.PI;
    this.targetData.angle = rotationDeg;

    // Apply to visual
    this.targetContainer.rotation = rotationRad;
  }

  private handleScale(handle: HandleType, dx: number, dy: number): void {
    const data = this.targetData;
    const initial = this.initialData;
    const constraints = this.constraints;
    if (!constraints) return;

    // Adjust dx/dy based on handle position and object rotation
    const rot = this.initialContainerRotation;
    const cos = Math.cos(-rot), sin = Math.sin(-rot);
    const localDx = dx * cos - dy * sin;
    const localDy = dx * sin + dy * cos;

    let newWidth = initial.width || initial.radius * 2 || 100;
    let newHeight = initial.height || initial.radius * 2 || 100;

    // Determine which dimensions to scale
    const scalesWidth = handle.includes('l') || handle.includes('r') ||
      handle === 'scale_tl' || handle === 'scale_tr' ||
      handle === 'scale_bl' || handle === 'scale_br';
    const scalesHeight = handle.includes('t') || handle.includes('b') ||
      handle === 'scale_tl' || handle === 'scale_tr' ||
      handle === 'scale_bl' || handle === 'scale_br';

    // Direction multipliers
    const xDir = handle.includes('r') || handle === 'scale_tr' || handle === 'scale_br' ? 1 : -1;
    const yDir = handle.includes('b') || handle === 'scale_bl' || handle === 'scale_br' ? 1 : -1;

    if (scalesWidth && this.constraints?.canScaleWidth) {
      newWidth = Math.max(MIN_SIZE, (initial.width || 100) + localDx * xDir * 2);
    }
    if (scalesHeight && this.constraints?.canScaleHeight) {
      newHeight = Math.max(MIN_SIZE, (initial.height || 100) + localDy * yDir * 2);
    }

    // Handle uniform scaling (circles)
    if (constraints.canScaleUniform && !constraints.canScaleWidth && !constraints.canScaleHeight) {
      let delta = 0;
      if (handle === 'scale_l' || handle === 'scale_r') {
        delta = localDx * xDir;
      } else {
        delta = localDy * yDir;
      }
      const newRadius = Math.max(MIN_SIZE / 2, (initial.radius || 50) + delta);
      data.radius = newRadius;
      return;
    }

    if (constraints.canScaleWidth) data.width = newWidth;
    if (constraints.canScaleHeight) data.height = newHeight;
  }

  private handleVertexMove(vertexIndex: number, dx: number, dy: number): void {
    const data = this.targetData;
    const initial = this.initialData;

    if (!data.points || !initial.points || vertexIndex >= data.points.length) return;

    // Transform dx/dy to local space (account for object rotation)
    const rot = this.initialContainerRotation;
    const cos = Math.cos(-rot), sin = Math.sin(-rot);
    const localDx = dx * cos - dy * sin;
    const localDy = dx * sin + dy * cos;

    // Calculate how much the object center has shifted due to re-centering
    const shiftX = data.x - initial.x;
    const shiftY = data.y - initial.y;

    // Transform shift to local space
    const shiftLocalX = shiftX * cos - shiftY * sin;
    const shiftLocalY = shiftX * sin + shiftY * cos;

    // Update the moved vertex (compensating for object center shift)
    data.points[vertexIndex] = {
      x: initial.points[vertexIndex].x + localDx - shiftLocalX,
      y: initial.points[vertexIndex].y + localDy - shiftLocalY
    };

    // Recalculate centroid and recenter the object (for triangles)
    if (data.points.length === 3) {
      this.recenterTriangle(data);
    }
  }

  /**
   * Recenterize a triangle so its centroid is at (0,0) in local space
   * This keeps the rotation pivot at the visual center of the triangle
   */
  private recenterTriangle(data: any): void {
    if (!data.points || data.points.length !== 3) return;

    // Calculate current centroid of the points
    const centroidX = (data.points[0].x + data.points[1].x + data.points[2].x) / 3;
    const centroidY = (data.points[0].y + data.points[1].y + data.points[2].y) / 3;

    // If centroid is already near (0,0), don't adjust
    if (Math.abs(centroidX) < 0.01 && Math.abs(centroidY) < 0.01) return;

    // Move the object's position to account for the centroid offset
    // Transform centroid offset from local to world space (account for rotation)
    const rot = this.targetContainer?.rotation || 0;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const worldOffsetX = centroidX * cos - centroidY * sin;
    const worldOffsetY = centroidX * sin + centroidY * cos;

    data.x += worldOffsetX;
    data.y += worldOffsetY;

    // Shift all vertices so centroid becomes (0,0)
    for (const point of data.points) {
      point.x -= centroidX;
      point.y -= centroidY;
    }

    // Update container position to match
    const scaleFactor = getScaleFactor();
    if (this.targetContainer) {
      this.targetContainer.position.set(data.x * scaleFactor, data.y * scaleFactor);
    }
  }

  private handleEndpointMove(handle: HandleType, dx: number, dy: number): void {
    const data = this.targetData;
    const initial = this.initialData;

    if (handle === 'endpoint_start') {
      data.x1 = initial.x1 + dx;
      data.y1 = initial.y1 + dy;
    } else {
      data.x2 = initial.x2 + dx;
      data.y2 = initial.y2 + dy;
    }
  }

  /**
   * Check if gizmo is currently in a drag operation
   */
  public isDraggingHandle(): boolean {
    return this.isDragging;
  }

  /**
   * Start a move operation from an external source (e.g., clicking directly on an object)
   * This allows selecting and immediately dragging an object in one motion
   */
  public startMoveFromExternal(e: PIXI.FederatedPointerEvent): void {
    if (!this.targetContainer || !this.targetData) return;

    this.isDragging = true;
    this.activeHandle = 'move';
    // Use nativeEvent coordinates to match onPointerMove which uses native PointerEvent
    this.dragStartGlobal = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
    this.hasMoved = false;
    this.isExternalStart = true;

    // Deep clone initial data
    this.initialData = JSON.parse(JSON.stringify(this.targetData));
    this.initialContainerPos = {
      x: this.targetContainer.position.x,
      y: this.targetContainer.position.y
    };
    this.initialContainerRotation = this.targetContainer.rotation;

    // Attach global listeners
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);

    this.onDragStart?.();
  }
}
