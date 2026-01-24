
import * as PIXI from 'pixi.js';
import { scale } from '../../config';
import { UIFactory } from '../UIFactory';
import { EditorUI } from '../EditorUI';

export interface EditorObject {
  container: PIXI.Container;
  data: any;
  type: string;
  lastFocused: number;
}

export class ObjectSelector extends PIXI.Container {
  private panelWidth: number;
  private panelHeight: number;
  private objects: EditorObject[];
  private onSelect: (obj: EditorObject) => void;
  private selectedObject: EditorObject | null = null;

  private scrollContainer: PIXI.Container;
  private contentContainer: PIXI.Container;
  private maskGraphic: PIXI.Graphics;

  private isDragging: boolean = false;
  private lastDragY: number = 0;
  private dragStartGlobalY: number = 0;
  private hasScrolled: boolean = false;

  constructor(width: number, height: number, objects: EditorObject[], onSelect: (obj: EditorObject) => void, selectedObject: EditorObject | null = null) {
    super();
    this.panelWidth = width;
    this.panelHeight = height;
    this.objects = objects; // Reference to live array? Or copy? 
    // If live array, we need to know when it updates.
    // Ideally we re-render when opened.
    this.onSelect = onSelect;
    this.selectedObject = selectedObject;

    // Background
    const bg = UIFactory.createCardBackground(width, height, 0x333333, scale(12));
    bg.alpha = 0.8;
    this.addChild(bg);

    // Scroll Area
    const margin = scale(10);
    const topOffset = scale(10);
    const scrollHeight = this.panelHeight - topOffset - margin;
    const scrollWidth = this.panelWidth - margin * 2;

    this.scrollContainer = new PIXI.Container();
    this.scrollContainer.position.set(margin, topOffset);
    this.addChild(this.scrollContainer);

    this.maskGraphic = new PIXI.Graphics();
    this.maskGraphic.rect(0, 0, scrollWidth, scrollHeight);
    this.maskGraphic.fill(0xFF0000);
    this.scrollContainer.addChild(this.maskGraphic);
    this.scrollContainer.mask = this.maskGraphic;

    // Interaction for scroll - Hit Area acts as background for dragging
    // Must be added BEFORE contentContainer so it is behind items
    const hitArea = new PIXI.Graphics();
    hitArea.rect(0, 0, scrollWidth, scrollHeight);
    hitArea.fill({ color: 0x000000, alpha: 0.001 });
    this.scrollContainer.addChild(hitArea);

    this.contentContainer = new PIXI.Container();
    this.scrollContainer.addChild(this.contentContainer);

    this.scrollContainer.eventMode = 'static';
    this.scrollContainer.cursor = 'grab';
    this.scrollContainer.on('pointerdown', this.onScrollStart, this);

    this.refresh();
  }

  public setSelection(obj: EditorObject | null) {
    this.selectedObject = obj;
    this.refresh();
  }

  public updateObjects(objects: EditorObject[]) {
    this.objects = objects;
    this.selectedObject = null;
    this.refresh();
  }

  public refresh() {
    this.contentContainer.removeChildren();

    // Sort objects by lastFocused (Descending)
    // Create a shallow copy to sort
    const sorted = [...this.objects].sort((a, b) => b.lastFocused - a.lastFocused);

    let y = 0;
    const itemHeight = scale(40);
    const width = this.panelWidth - scale(20);

    sorted.forEach((obj) => {
      const item = new PIXI.Container();
      item.position.set(0, y);

      // Bg
      const bg = new PIXI.Graphics();
      bg.roundRect(0, 0, width, itemHeight - scale(5), scale(5));

      if (obj === this.selectedObject) {
        // Selected: Blue stroke + faint blue fill
        bg.stroke({ width: scale(2), color: 0x00AAFF });
        bg.fill({ color: 0x00AAFF, alpha: 0.2 });
      } else {
        // Normal: Gray fill
        bg.fill({ color: 0x555555, alpha: 0.5 });
      }

      item.addChild(bg);

      // Icon
      const icon = new PIXI.Graphics();
      const iconSize = scale(30);

      // Determine type/subtype
      // type is obj.type (e.g. 'obstacle', 'falling', or specific like 'ball_blue')
      let type = obj.type;
      let subType = obj.data.type || '';

      // Map specialized types
      if (type === 'ball_blue' || type === 'ball_pink') {
        // Ball icon? We don't have explicit ball icon logic in drawObjectIcon yet?
        // Checking EditorUI.drawObjectIcon logic...
        // It handles 'obstacle', 'falling', 'special'.
        // Does it handle balls?
        // If not, we might need a fallback or update drawObjectIcon.
        // Let's assume balls are special or just draw a circle.
      } else if (type === 'conveyor' || type === 'net' || type === 'ice' || type === 'laser' || type === 'seesaw' || type === 'button') {
        subType = type;
        type = 'special';
      }

      // Manual handling for balls as they aren't in standard categories
      if (type === 'ball_blue') {
        icon.circle(0, 0, iconSize / 2).fill(0x00AAFF);
      } else if (type === 'ball_pink') {
        icon.circle(0, 0, iconSize / 2).fill(0xFF69B4);
      } else {
        EditorUI.drawObjectIcon(icon, type, subType, iconSize);
      }

      icon.position.set(width / 2, (itemHeight - scale(5)) / 2);
      item.addChild(icon);

      // Select Action
      item.eventMode = 'static';
      item.cursor = 'pointer';
      item.on('pointertap', () => {
        if (!this.hasScrolled) {
          this.onSelect(obj);
        }
      });

      this.contentContainer.addChild(item);
      y += itemHeight;
    });
  }

  private onScrollStart(e: PIXI.FederatedPointerEvent) {
    this.isDragging = true;
    this.hasScrolled = false;
    this.lastDragY = e.global.y;
    this.dragStartGlobalY = e.global.y;
    this.scrollContainer.on('globalpointermove', this.onScrollMove, this);
    this.scrollContainer.on('pointerup', this.onScrollEnd, this);
    this.scrollContainer.on('pointerupoutside', this.onScrollEnd, this);
  }

  private onScrollMove(e: PIXI.FederatedPointerEvent) {
    if (!this.isDragging) return;
    const dy = e.global.y - this.lastDragY;
    this.lastDragY = e.global.y;

    if (!this.hasScrolled && Math.abs(e.global.y - this.dragStartGlobalY) > scale(5)) {
      this.hasScrolled = true;
    }

    this.contentContainer.y += dy;

    // Bounds check
    const minY = Math.min(0, this.panelHeight - scale(60) - this.contentContainer.height);
    if (this.contentContainer.y > 0) this.contentContainer.y = 0;
    if (this.contentContainer.y < minY) this.contentContainer.y = minY;
  }

  private onScrollEnd() {
    this.isDragging = false;
    this.scrollContainer.off('globalpointermove', this.onScrollMove, this);
    this.scrollContainer.off('pointerup', this.onScrollEnd, this);
    this.scrollContainer.off('pointerupoutside', this.onScrollEnd, this);
  }
}
