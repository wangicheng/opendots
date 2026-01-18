
import * as PIXI from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { PENS } from '../data/PenData';
import type { Pen } from '../data/PenData';

export class PenSelectionUI extends PIXI.Container {
  private overlay!: PIXI.Graphics;
  private card!: PIXI.Container;
  private carouselContainer!: PIXI.Container;
  private penItems: PIXI.Container[] = [];
  private scrollX: number = 0;
  private targetScrollX: number = 0;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartScrollX: number = 0;
  private selectedPenIndex: number = 0;
  private onSelectCallback: (pen: Pen) => void;
  private onCloseCallback: () => void;

  // Layout Constants
  private readonly CARD_WIDTH = 755;
  private readonly CARD_HEIGHT = 500;
  private readonly ITEM_SPACING = 150;
  private readonly CENTER_X = 755 / 2;

  constructor(onSelect: (pen: Pen) => void, onClose: () => void, initialPenId?: string) {
    super();
    this.onSelectCallback = onSelect;
    this.onCloseCallback = onClose;

    this.createOverlay();
    this.createCard();
    this.setupInteractions();

    // Initial Layout
    let initialIndex = 0;
    if (initialPenId) {
      initialIndex = PENS.findIndex(p => p.id === initialPenId);
      if (initialIndex === -1) initialIndex = 0;
    }
    this.centerOnIndex(initialIndex);
    this.scrollX = this.targetScrollX; // Jump immediately, no animation for initial open

    // Animate loop for smooth scrolling
    PIXI.Ticker.shared.add(this.update, this);
  }

  private createOverlay(): void {
    this.overlay = new PIXI.Graphics();
    this.overlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.overlay.fill({ color: 0x000000, alpha: 0.35 });
    this.overlay.eventMode = 'static'; // Block clicks below
    this.addChild(this.overlay);
  }

  private createCard(): void {
    this.card = new PIXI.Container();
    this.card.position.set(
      (GAME_WIDTH - this.CARD_WIDTH) / 2,
      (GAME_HEIGHT - this.CARD_HEIGHT) / 2
    );
    this.addChild(this.card);

    // Shadow
    const shadow = new PIXI.Graphics();
    shadow.roundRect(0, 8, this.CARD_WIDTH, this.CARD_HEIGHT, 0);
    shadow.fill({ color: 0x000000, alpha: 0.2 });
    const blur = new PIXI.BlurFilter();
    blur.strength = 10;
    shadow.filters = [blur];
    this.card.addChild(shadow);

    // Background
    const bg = new PIXI.Graphics();
    bg.roundRect(0, 0, this.CARD_WIDTH, this.CARD_HEIGHT, 0); // No rounded corners as requested ("完美的長方形")
    bg.fill(0xFFFFFF);
    this.card.addChild(bg);

    // Header
    this.createHeader();

    // Content (Carousel)
    this.createCarousel();

    // Footer
    this.createFooter();
  }

  private createHeader(): void {
    const headerY = 30;

    // Status Badge (Left)
    const badge = new PIXI.Container();
    const badgeBg = new PIXI.Graphics();
    badgeBg.roundRect(0, 0, 164, 60, 30);
    badgeBg.fill(0xF2F2F2);
    badge.addChild(badgeBg);

    const penIcon = new PIXI.Text({ text: '✒️', style: { fontSize: 32 } }); // Placeholder icon
    penIcon.position.set(10, 12);
    badge.addChild(penIcon);

    const countText = new PIXI.Text({ text: `${PENS.length} / ${PENS.length}`, style: { fontFamily: 'Arial', fontSize: 28, fill: 0x555555 } });
    countText.position.set(55, 14);
    badge.addChild(countText);

    badge.position.set(30, headerY);
    this.card.addChild(badge);

    // Title (Center)
    const title = new PIXI.Text({ text: 'Choose a pen', style: { fontFamily: 'Arial', fontSize: 40, fill: 0x3E3E3E } });
    title.anchor.set(0.5, 0);
    title.position.set(this.CARD_WIDTH / 2, headerY);
    this.card.addChild(title);

    // Close Button (Right)
    const closeBtn = new PIXI.Container();
    const closeBg = new PIXI.Graphics();
    closeBg.circle(0, 0, 25);
    closeBg.fill(0x555555);
    closeBtn.addChild(closeBg);

    const closeText = new PIXI.Text({ text: '×', style: { fontFamily: 'Arial', fontSize: 40, fill: 0xFFFFFF } });
    closeText.anchor.set(0.5);
    closeBtn.addChild(closeText);

    closeBtn.position.set(this.CARD_WIDTH - 30 - 25, headerY + 25);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointertap', this.onCloseCallback);
    this.card.addChild(closeBtn);
  }

  private createCarousel(): void {
    // Mask
    const mask = new PIXI.Graphics();
    mask.rect(0, 100, this.CARD_WIDTH, 300);
    mask.fill(0xFF0000);
    this.card.addChild(mask);

    this.carouselContainer = new PIXI.Container();
    this.carouselContainer.mask = mask;
    this.card.addChild(this.carouselContainer);

    // Create Items
    PENS.forEach((pen, index) => {
      const item = this.createPenItem(pen);
      item.x = index * this.ITEM_SPACING;
      item.y = 230; // Vertical center of carousel area
      this.carouselContainer.addChild(item);
      this.penItems.push(item);
    });
  }

  private createPenItem(pen: Pen): PIXI.Container {
    const item = new PIXI.Container();

    // Visual representation of the pen
    const gfx = new PIXI.Graphics();

    // Pen body
    gfx.rect(-10, -60, 20, 120);
    gfx.fill(pen.color);

    // Pen tip
    gfx.moveTo(-10, 60);
    gfx.lineTo(0, 80);
    gfx.lineTo(10, 60);
    gfx.fill(0x333333);

    // Apply scaling and rotation
    gfx.scale.set(1.4);
    gfx.angle = 30;

    // Label
    const text = new PIXI.Text({ text: pen.name, style: { fontFamily: 'Arial', fontSize: 20, fill: 0x333333 } });
    text.anchor.set(0.5);
    text.y = 130;

    item.addChild(gfx);
    item.addChild(text);

    return item;
  }

  private createFooter(): void {
    const btn = new PIXI.Container();
    const btnWidth = 210;
    const btnHeight = 67;

    const bg = new PIXI.Graphics();
    bg.roundRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, btnHeight / 2);
    bg.fill(0x37A4E9);
    btn.addChild(bg);

    const text = new PIXI.Text({ text: 'Use', style: { fontFamily: 'Arial', fontSize: 28, fill: 0xFFFFFF } });
    text.anchor.set(0.5);
    btn.addChild(text);

    btn.position.set(this.CARD_WIDTH / 2, this.CARD_HEIGHT - 60);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointertap', () => {
      const selectedPen = PENS[this.selectedPenIndex];
      this.onSelectCallback(selectedPen);
    });

    this.card.addChild(btn);
  }

  private setupInteractions(): void {
    // Touch/Drag on carousel area
    const hitArea = new PIXI.Graphics();
    hitArea.rect(0, 100, this.CARD_WIDTH, 300);
    hitArea.fill({ color: 0x000000, alpha: 0 }); // Transparent hit area
    hitArea.eventMode = 'static';
    hitArea.cursor = 'grab';
    this.card.addChild(hitArea);

    hitArea.on('pointerdown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.global.x;
      this.dragStartScrollX = this.scrollX;
      hitArea.cursor = 'grabbing';
    });

    const onDragMove = (e: PIXI.FederatedPointerEvent) => {
      if (!this.isDragging) return;
      const delta = e.global.x - this.dragStartX;
      this.scrollX = this.dragStartScrollX - delta;
      this.targetScrollX = this.scrollX; // Sync target to follow finger directly
    };

    const onDragEnd = (e: PIXI.FederatedPointerEvent) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      hitArea.cursor = 'grab';

      const dragDistance = Math.abs(e.global.x - this.dragStartX);

      // If swift tap (not drag) and released inside, scroll to clicked item
      if (e.type !== 'pointerupoutside' && dragDistance < 10) {
        const localPoint = this.carouselContainer.toLocal(e.global);
        const index = Math.round(localPoint.x / this.ITEM_SPACING);
        this.centerOnIndex(index);
      } else {
        // Snap to nearest
        const index = Math.round(this.scrollX / this.ITEM_SPACING);
        this.centerOnIndex(index);
      }
    };

    hitArea.on('globalpointermove', onDragMove);
    hitArea.on('pointerup', onDragEnd);
    hitArea.on('pointerupoutside', onDragEnd);
  }

  private centerOnIndex(index: number): void {
    // Clamp
    index = Math.max(0, Math.min(index, PENS.length - 1));
    this.selectedPenIndex = index;

    // Calculate scroll position where this item is in the center
    // Item X is index * SPACING
    // We want Item X to be at CENTER_X relative to the container?
    // No, scrollX is the offset of the container. 
    // Container X = -scrollX + initialOffset
    // We want (index * SPACING) + ContainerX = CENTER_X
    // (index * SPACING) - targetScrollX + WIDTH/2 = CENTER_X (which is WIDTH/2)
    // So targetScrollX = index * SPACING

    this.targetScrollX = index * this.ITEM_SPACING;
  }

  private update(): void {
    if (!this.card.parent) return; // Don't update if removed

    // Smooth scroll
    if (!this.isDragging) {
      this.scrollX += (this.targetScrollX - this.scrollX) * 0.1;
    }

    // Update container position
    // We want the scrollX point to be at the center of the screen
    // Visual Offset = CENTER_X - scrollX
    this.carouselContainer.x = this.CENTER_X - this.scrollX;

    // Update Scales based on distance from center
    this.penItems.forEach((item) => {
      const itemGlobalX = this.carouselContainer.x + item.x;
      const distFromCenter = Math.abs(itemGlobalX - this.CENTER_X);

      // Scale calculation: 1.0 at center, 0.4 at spacing distance
      let scale = 1.0 - (distFromCenter / this.ITEM_SPACING) * 0.6;
      scale = Math.max(0.4, scale); // Min scale

      item.scale.set(scale);
      item.alpha = Math.max(0.5, scale); // Fade out slightly
    });
  }

  destroy(options?: any): void {
    PIXI.Ticker.shared.remove(this.update, this);
    super.destroy(options);
  }
}
