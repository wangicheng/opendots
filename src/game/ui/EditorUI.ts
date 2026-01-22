import * as PIXI from 'pixi.js';
import {
  getCanvasWidth,
  getCanvasHeight,
  scale,
} from '../config';

// Local visual constants matches object definitions
const LASER_COLOR = 0x00FF00; // Green for laser

export class EditorUI extends PIXI.Container {
  private currentMode: 'edit' | 'play' = 'edit';
  private toggleContainer: PIXI.Container | null = null;
  private currentCategory: 'obstacle' | 'falling' | 'special' = 'obstacle';
  private tabsContainer: PIXI.Container | null = null;
  private itemsContainer: PIXI.Container | null = null;

  private backBtn: PIXI.Container | null = null;
  private toolsContainer: PIXI.Container | null = null;
  private bottomBar: PIXI.Graphics | null = null;
  private copyBtn: PIXI.Container | null = null;
  private deleteBtn: PIXI.Container | null = null;

  // Callbacks
  private onClose: () => void;
  private onToggleMode: (mode: 'edit' | 'play') => void;
  private onAddObject: (type: string, subType: string, eventData?: any) => void;
  private onCopy: () => void;
  private onDelete: () => void;
  private onRestart: () => void;
  private onPen: () => void;

  private playHomeBtn: PIXI.Container | null = null;
  private playRestartBtn: PIXI.Container | null = null;
  private playPenBtn: PIXI.Container | null = null;

  // State tracking for layout restoration
  private lastHasSelection: boolean = false;
  private lastIsBall: boolean = false;

  constructor(
    onClose: () => void,
    onToggleMode: (mode: 'edit' | 'play') => void,
    onAddObject: (type: string, subType: string, eventData?: any) => void,
    onCopy: () => void,
    onDelete: () => void,
    onRestart: () => void,
    onPen: () => void
  ) {
    super();
    // Set to passive so pointer events pass through to game container for drawing
    this.eventMode = 'passive';
    this.onClose = onClose;
    this.onToggleMode = onToggleMode;
    this.onAddObject = onAddObject;
    this.onCopy = onCopy;
    this.onDelete = onDelete;
    this.onRestart = onRestart;
    this.onPen = onPen;

    this.updateLayout();
  }

  public updateLayout(): void {
    this.removeChildren();
    const width = getCanvasWidth();

    const btnY = scale(36);
    const btnSize = scale(52);
    const btnSpacing = scale(20);
    const margin = scale(20);

    // Back Button (Left)
    this.backBtn = this.createButton('\uF284', margin, btnY, this.onClose);

    // Edit/Play Toggle (Center)
    // Align center of toggle with center of buttons
    const centerY = btnY + btnSize / 2;
    this.createToggle(width / 2, centerY);

    // Tools Container (Right) - Copy and Delete
    this.toolsContainer = new PIXI.Container();
    this.addChild(this.toolsContainer);

    // Delete Button (Rightmost)
    const deleteX = width - margin - btnSize;
    this.deleteBtn = this.createButton('\uF78A', deleteX, btnY, this.onDelete, this.toolsContainer);

    // Copy Button (Left of Delete)
    const copyX = deleteX - btnSpacing - btnSize;
    this.copyBtn = this.createButton('\uF759', copyX, btnY, this.onCopy, this.toolsContainer);

    // Restore tool state
    this.updateTools(this.lastHasSelection, this.lastIsBall);

    // Bottom Bar (Tools)
    this.createBottomBar();

    // Play Mode Buttons (Mimic Game.ts UI)
    // Home Button (Top Left) - Returns to Edit Mode
    this.playHomeBtn = this.createButton('\uF284', margin, btnY, () => {
      this.onClose();
    });

    // Restart Button (Top Right)
    const restartX = width - margin - btnSize;
    this.playRestartBtn = this.createButton('\uF116', restartX, btnY, this.onRestart);

    // Pen Button (Left of Restart)
    const penX = restartX - btnSpacing - btnSize;
    this.playPenBtn = this.createButton('\uF604', penX, btnY, this.onPen);

    // Restore UI State (Visibility)
    this.setUIState(this.currentMode);
  }

  private createToggle(x: number, y: number): void {
    this.toggleContainer = new PIXI.Container();
    this.toggleContainer.position.set(x, y);
    this.addChild(this.toggleContainer);

    // Initial render
    this.updateToggleState();

    this.toggleContainer.eventMode = 'static';
    this.toggleContainer.cursor = 'pointer';
    this.toggleContainer.on('pointertap', (e) => {
      const local = this.toggleContainer!.toLocal(e.global);
      if (local.x < 0) {
        if (this.currentMode !== 'edit') {
          this.currentMode = 'edit';
          this.onToggleMode('edit');
          this.updateToggleState();
          this.setUIState('edit');
        }
      } else {
        if (this.currentMode !== 'play') {
          this.currentMode = 'play';
          // Force UI update immediately if desired, or wait for Game to confirm? 
          // Let's assume Game might verify, but here we update UI for responsiveness.
          // Note: Game logic handles the actual scene switch.
          this.onToggleMode('play');
          this.updateToggleState();
          this.setUIState('play');
        }
      }
    });
  }

  private updateToggleState(): void {
    if (!this.toggleContainer) return;

    // Clear previous dynamic graphics
    this.toggleContainer.removeChildren();

    const w = scale(240);
    const h = scale(40);
    const r = scale(20);

    // Base Background (White with Gray Border)
    const bg = new PIXI.Graphics();
    bg.roundRect(-w / 2, -h / 2, w, h, r);
    bg.fill({ color: 0xFFFFFF, alpha: 0.5 });
    bg.stroke({ color: 0x555555, width: scale(1.5), alpha: 0.5 });
    this.toggleContainer.addChild(bg);

    // Active Highlight
    const highlight = new PIXI.Graphics();
    highlight.fill({ color: 0x555555, alpha: 0.8 });

    if (this.currentMode === 'edit') {
      // Left half active - Gray Background
      highlight.beginPath();
      highlight.moveTo(0, -h / 2);
      highlight.lineTo(0, h / 2);
      highlight.lineTo(-w / 2 + r, h / 2);
      highlight.arc(-w / 2 + r, h / 2 - r, r, 0.5 * Math.PI, 1.0 * Math.PI);
      highlight.lineTo(-w / 2, -h / 2 + r);
      highlight.arc(-w / 2 + r, -h / 2 + r, r, 1.0 * Math.PI, 1.5 * Math.PI);
      highlight.lineTo(0, -h / 2);
      highlight.fill();
    } else {
      // Play mode - Right active
      highlight.beginPath();
      highlight.moveTo(0, -h / 2);
      highlight.lineTo(w / 2 - r, -h / 2);
      highlight.arc(w / 2 - r, -h / 2 + r, r, 1.5 * Math.PI, 0);
      highlight.lineTo(w / 2, h / 2 - r);
      highlight.arc(w / 2 - r, h / 2 - r, r, 0, 0.5 * Math.PI);
      highlight.lineTo(0, h / 2);
      highlight.lineTo(0, -h / 2);
      highlight.fill();
    }
    this.toggleContainer.addChild(highlight);

    // Text
    const editStyle: Partial<PIXI.TextStyle> = {
      fontFamily: 'Arial',
      fontSize: scale(20),
      fill: this.currentMode === 'edit' ? '#FFFFFF' : '#555555',
      fontWeight: 'bold' as PIXI.TextStyleFontWeight
    };
    const playStyle: Partial<PIXI.TextStyle> = {
      fontFamily: 'Arial',
      fontSize: scale(20),
      fill: this.currentMode === 'play' ? '#FFFFFF' : '#555555',
      fontWeight: 'bold' as PIXI.TextStyleFontWeight
    };

    const editText = new PIXI.Text('Edit', editStyle);
    editText.anchor.set(0.5);
    editText.position.set(-w / 4, 0);

    const playText = new PIXI.Text('Play', playStyle);
    playText.anchor.set(0.5);
    playText.position.set(w / 4, 0);

    this.toggleContainer.addChild(editText);
    this.toggleContainer.addChild(playText);
  }

  public setUIState(mode: 'edit' | 'play'): void {
    this.currentMode = mode;
    this.updateToggleState();

    if (mode === 'edit') {
      if (this.bottomBar) this.bottomBar.visible = true;
      if (this.tabsContainer) this.tabsContainer.visible = true;
      if (this.itemsContainer) this.itemsContainer.visible = true;
      if (this.toolsContainer) this.toolsContainer.visible = true;
      if (this.backBtn) this.backBtn.visible = true;

      if (this.playHomeBtn) this.playHomeBtn.visible = false;
      if (this.playRestartBtn) this.playRestartBtn.visible = false;
      if (this.playPenBtn) this.playPenBtn.visible = false;
    } else {
      if (this.bottomBar) this.bottomBar.visible = false;
      if (this.tabsContainer) this.tabsContainer.visible = false;
      if (this.itemsContainer) this.itemsContainer.visible = false;
      if (this.toolsContainer) this.toolsContainer.visible = false;
      // Hide Back button during test play to avoid conflict with Game UI
      if (this.backBtn) this.backBtn.visible = false;

      // Show Play Mode Buttons
      if (this.playHomeBtn) this.playHomeBtn.visible = true;
      if (this.playRestartBtn) this.playRestartBtn.visible = true;
      if (this.playPenBtn) this.playPenBtn.visible = true;
    }
  }

  public updateTools(hasSelection: boolean, isBall: boolean): void {
    // Save state for layout restoration
    this.lastHasSelection = hasSelection;
    this.lastIsBall = isBall;

    if (!this.copyBtn || !this.deleteBtn) return;

    // Copy/Delete Rules:
    // Copy: enabled if hasSelection and !isBall
    // Delete: enabled if hasSelection and !isBall

    const canDo = hasSelection && !isBall;
    const alpha = 0.9;
    const mode = canDo ? 'static' : 'none';

    this.copyBtn.alpha = alpha;
    this.copyBtn.eventMode = mode;

    this.deleteBtn.alpha = alpha;
    this.deleteBtn.eventMode = mode;
  }

  private createButton(iconChar: string, x: number, y: number, onClick: () => void, parent?: PIXI.Container): PIXI.Container {
    const size = scale(52); // Match Game.ts button size
    const container = new PIXI.Container();
    container.position.set(x, y);

    // Invisible Hit Area
    const hitArea = new PIXI.Graphics();
    hitArea.rect(0, 0, size, size);
    hitArea.fill({ color: 0xFFFFFF, alpha: 0.001 });
    container.addChild(hitArea);

    // Icon Text (Matched style from Game.ts)
    const text = new PIXI.Text({
      text: iconChar,
      style: {
        fontFamily: 'bootstrap-icons',
        fontSize: scale(60), // Match Game.ts font size
        fill: '#555555',
        stroke: { color: '#555555', width: 0.5 },
        align: 'center',
        padding: scale(10)
      }
    });
    text.anchor.set(0.5);
    text.position.set(size / 2, size / 2);
    container.addChild(text);

    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointertap', onClick);

    if (parent) {
      parent.addChild(container);
    } else {
      this.addChild(container);
    }

    return container;
  }

  private createBottomBar(): void {
    const width = getCanvasWidth();
    const height = getCanvasHeight();
    const barHeight = scale(140);
    const tabHeight = scale(40);

    this.bottomBar = new PIXI.Graphics();
    // Start background below tabs
    this.bottomBar.rect(0, height - barHeight + tabHeight, width, barHeight - tabHeight);
    this.bottomBar.fill({ color: 0x333333, alpha: 0.8 });
    this.addChild(this.bottomBar);

    // Tabs
    this.createTabs(height - barHeight);

    // Items Area
    this.itemsContainer = new PIXI.Container();
    this.itemsContainer.position.set(0, height - barHeight + tabHeight); // Below tabs
    this.addChild(this.itemsContainer);

    this.renderItems();
  }

  private createTabs(y: number): void {
    if (this.tabsContainer) {
      this.removeChild(this.tabsContainer);
      this.tabsContainer.destroy();
    }
    this.tabsContainer = new PIXI.Container();
    this.tabsContainer.position.set(0, y);
    this.addChild(this.tabsContainer);

    const categories: ('obstacle' | 'falling' | 'special')[] = ['obstacle', 'falling', 'special'];
    const tabWidth = scale(80);
    const tabHeight = scale(40);

    categories.forEach((cat, index) => {
      const tab = new PIXI.Container();
      tab.position.set(index * tabWidth, 0);

      // Background
      const isActive = this.currentCategory === cat;
      const bg = new PIXI.Graphics();
      if (isActive) {
        bg.rect(0, 0, tabWidth, tabHeight);
        bg.fill({ color: 0x333333, alpha: 0.8 }); // Match bottom bar color
      } else {
        bg.rect(0, 0, tabWidth, tabHeight);
        bg.fill({ color: 0x555555, alpha: 0.8 });
      }
      tab.addChild(bg);

      // Icons instead of text
      const icon = new PIXI.Graphics();
      const iconSize = scale(20);
      const color = 0xCCCCCC;

      if (cat === 'obstacle') {
        // Solid Square
        icon.rect(-iconSize / 2, -iconSize / 2, iconSize, iconSize);
        icon.fill(color);
      } else if (cat === 'falling') {
        // Hollow Square
        const strokeWidth = scale(2.5);
        icon.rect(-iconSize / 2 + strokeWidth / 2, -iconSize / 2 + strokeWidth / 2, iconSize - strokeWidth, iconSize - strokeWidth);
        icon.stroke({ color, width: strokeWidth });
      } else if (cat === 'special') {
        // Simple Conveyor Icon
        const cw = iconSize;
        const ch = iconSize * 0.5;
        const cr = ch / 2;
        icon.roundRect(-cw / 2, -ch / 2, cw, ch, cr);
        icon.stroke({ color, width: scale(2) });
        icon.circle(-cw / 2 + cr, 0, cr * 0.6);
        icon.circle(cw / 2 - cr, 0, cr * 0.6);
        icon.fill(color);
      }

      icon.position.set(tabWidth / 2, tabHeight / 2);
      tab.addChild(icon);

      // Interactivity
      tab.eventMode = 'static';
      tab.cursor = 'pointer';
      tab.on('pointertap', () => {
        if (this.currentCategory !== cat) {
          this.currentCategory = cat;
          this.createTabs(y); // Re-render tabs
          this.renderItems(); // Render items
        }
      });

      this.tabsContainer!.addChild(tab);
    });
  }

  private renderItems(): void {
    if (!this.itemsContainer) return;
    this.itemsContainer.removeChildren();

    const category = this.currentCategory;
    const items: { type: string, subType: string }[] = [];

    // Define Items
    if (category === 'obstacle') {
      items.push({ type: 'obstacle', subType: 'circle' });
      items.push({ type: 'obstacle', subType: 'triangle' });
      items.push({ type: 'obstacle', subType: 'rectangle' });
      items.push({ type: 'obstacle', subType: 'c_shape' });
      items.push({ type: 'obstacle', subType: 'bezier' });
    } else if (category === 'falling') {
      items.push({ type: 'falling', subType: 'circle' });
      items.push({ type: 'falling', subType: 'triangle' });
      items.push({ type: 'falling', subType: 'rectangle' });
    } else if (category === 'special') {
      items.push({ type: 'special', subType: 'conveyor' });
      items.push({ type: 'special', subType: 'net' });
      items.push({ type: 'special', subType: 'laser' });
      items.push({ type: 'special', subType: 'button' });
      items.push({ type: 'special', subType: 'seesaw' });
      items.push({ type: 'special', subType: 'ice' });
    }

    // Render Grid
    const itemSize = scale(60);
    const gap = scale(20);
    const startX = gap;
    const startY = scale(20); // Relative to itemsContainer

    items.forEach((item, index) => {
      const x = startX + (index * (itemSize + gap));
      // Simple horizontal scroll or wrap? 
      // For now, simple row. If too many, maybe wrap?
      // Special has 6 items. 6 * 80 = 480. Fits on most screens.
      // If screen is small, might need logic.

      this.createItemButton(item, x, startY, itemSize);
    });
  }

  private createItemButton(item: { type: string, subType: string }, x: number, y: number, size: number): void {
    const btn = new PIXI.Container();
    btn.position.set(x, y);

    // Background (Transparent Hit Area)
    const bg = new PIXI.Graphics();
    bg.roundRect(0, 0, size, size, scale(10));
    bg.fill({ color: 0x000000, alpha: 0.001 }); // Transparent hit area
    btn.addChild(bg);

    // Icon
    const icon = new PIXI.Graphics();
    const cx = size / 2;
    const cy = size / 2;
    const iconSize = size * 0.6; // Scale down for icon

    icon.position.set(cx, cy);

    // Draw Icon Shape
    this.drawItemIcon(icon, item.type, item.subType, iconSize);

    btn.addChild(icon);

    // Interaction
    btn.eventMode = 'static';
    btn.cursor = 'grab';

    // Drag Logic
    let isDragging = false;
    let startPoint = { x: 0, y: 0 };

    const onMove = (e: PIXI.FederatedPointerEvent) => {
      const dx = e.global.x - startPoint.x;
      const dy = e.global.y - startPoint.y;
      if (Math.hypot(dx, dy) > scale(10)) {
        isDragging = true;

        // Trigger Add Object with Drag
        this.onAddObject(item.type, item.subType, e);

        cleanup();
      }
    };

    const onUp = () => {
      if (!isDragging) {
        // Click detected
        this.onAddObject(item.type, item.subType);
      }
      cleanup();
    };

    const cleanup = () => {
      btn.off('globalpointermove', onMove);
      btn.off('pointerup', onUp);
      btn.off('pointerupoutside', onUp);
      btn.alpha = 1;
    };

    btn.on('pointerdown', (e) => {
      startPoint = { x: e.global.x, y: e.global.y };
      isDragging = false;
      btn.alpha = 0.9;

      btn.on('globalpointermove', onMove);
      btn.on('pointerup', onUp);
      btn.on('pointerupoutside', onUp);
    });

    this.itemsContainer!.addChild(btn);
  }

  private drawItemIcon(g: PIXI.Graphics, type: string, subType: string, size: number): void {
    // Reset defaults
    g.clear();

    const r = size / 2;
    const white = 0xFFFFFF;

    if (type === 'obstacle') {
      if (subType === 'circle') {
        g.circle(0, 0, r);
        g.fill({ color: white });
      } else if (subType === 'triangle') {
        g.poly([0, -r, r, r, -r, r]);
        g.fill({ color: white });
      } else if (subType === 'rectangle') {
        g.rect(-r, -r, size, size);
        g.fill({ color: white });
      } else if (subType === 'c_shape') {
        // Solid C-shape representation: Arc open on right
        g.arc(0, 0, r * 0.8, Math.PI * 0.25, Math.PI * 1.75);
        g.stroke({ color: white, width: r * 0.4, cap: 'round' });
      } else if (subType === 'bezier') {
        // Curve representation S-like or simple curve
        g.moveTo(-r * 0.8, r * 0.5);
        g.quadraticCurveTo(0, -r * 1.2, r * 0.8, r * 0.5);
        g.stroke({ color: white, width: r * 0.3, cap: 'round' });
      }
    } else if (type === 'falling') {
      // Hollow representation
      const strokeWidth = scale(2);
      if (subType === 'circle') {
        g.circle(0, 0, r - strokeWidth);
        g.stroke({ color: white, width: strokeWidth });
      } else if (subType === 'triangle') {
        g.poly([0, -r + strokeWidth, r - strokeWidth, r - strokeWidth, -r + strokeWidth, r - strokeWidth]);
        g.stroke({ color: white, width: strokeWidth });
      } else if (subType === 'rectangle') {
        g.rect(-r + strokeWidth / 2, -r + strokeWidth / 2, size - strokeWidth, size - strokeWidth);
        g.stroke({ color: white, width: strokeWidth });
      }
    } else if (type === 'special') {
      if (subType === 'conveyor') {
        const height = size * 0.5;
        const radius = height / 2;
        const width = size;

        // Outline
        g.roundRect(-width / 2, -height / 2, width, height, radius);
        g.stroke({ width: 2, color: white });

        // Gears (Circles)
        const gearSize = height * 0.6;
        g.circle(-width / 2 + radius, 0, gearSize / 2);
        g.circle(width / 2 - radius, 0, gearSize / 2);
        g.fill(white);
      } else if (subType === 'net') {
        const w = size * 0.8;
        const h = size * 0.8;
        g.roundRect(-w / 2, -h / 2, w, h, 4);
        g.stroke({ width: 2, color: white });

        // Grid lines
        g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0);
        g.moveTo(0, -h / 2); g.lineTo(0, h / 2);
        g.stroke({ width: 1, color: white, alpha: 0.5 });
      } else if (subType === 'laser') {
        const w = size;
        const h = scale(6);
        g.rect(-w / 2, -h / 2, w, h);
        g.fill(LASER_COLOR); // Keep Green
      } else if (subType === 'button') {
        const tThickness = scale(4);
        const tWidth = size * 0.6;
        const tHeight = size * 0.6;
        g.rect(-tWidth / 2, -tHeight / 2, tWidth, tThickness);
        g.rect(-tThickness / 2, -tHeight / 2, tThickness, tHeight);
        g.fill(white);
      } else if (subType === 'seesaw') {
        // Hollow flat rectangle
        const w = size;
        const h = scale(8); // Slightly thicker to be visible as hollow
        g.rect(-w / 2, -h / 2, w, h);
        g.stroke({ color: white, width: scale(2) });

        // Center point
        g.circle(0, 0, scale(3));
        g.fill(white);
      } else if (subType === 'ice') {
        const iceBlue = 0x83B0C9;
        g.rect(-r, -r, size, size);
        g.fill({ color: iceBlue, alpha: 1.0 });
      }
    }
  }
}
