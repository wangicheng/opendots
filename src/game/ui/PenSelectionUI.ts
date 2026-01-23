
import * as PIXI from 'pixi.js';
import { getCanvasWidth, getCanvasHeight, scale } from '../config';
import { PENS } from '../data/PenData';
import type { Pen } from '../data/PenData';
import { LanguageManager, type TranslationKey } from '../i18n/LanguageManager';

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

  // Layout Constants (Design reference)
  private readonly DESIGN_CARD_WIDTH = 755;
  private readonly DESIGN_CARD_HEIGHT = 500;
  private readonly DESIGN_ITEM_SPACING = 150;

  // Actual values (scaled)
  private cardWidth = 0;
  private cardHeight = 0;
  private itemSpacing = 0;
  private centerX = 0;

  constructor(onSelect: (pen: Pen) => void, onClose: () => void, initialPenId?: string) {
    super();
    this.onSelectCallback = onSelect;
    this.onCloseCallback = onClose;

    this.updateLayoutValues();

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
    this.scrollX = this.targetScrollX;

    PIXI.Ticker.shared.add(this.update, this);

    // Listen for resize
    window.addEventListener('resize', this.handleResize);
  }

  private updateLayoutValues(): void {
    this.cardWidth = scale(this.DESIGN_CARD_WIDTH);
    this.cardHeight = scale(this.DESIGN_CARD_HEIGHT);
    this.itemSpacing = scale(this.DESIGN_ITEM_SPACING);
    this.centerX = this.cardWidth / 2;
  }

  private handleResize = (): void => {
    this.updateLayoutValues();
    this.refreshUI();
  };

  private refreshUI(): void {
    this.removeChildren();
    this.penItems = [];

    this.createOverlay();
    this.createCard();
    this.setupInteractions();

    // Maintain selection
    this.centerOnIndex(this.selectedPenIndex);
    this.scrollX = this.targetScrollX;
  }

  private createOverlay(): void {
    this.overlay = new PIXI.Graphics();
    this.overlay.rect(0, 0, getCanvasWidth(), getCanvasHeight());
    this.overlay.fill({ color: 0x000000, alpha: 0.35 });
    this.overlay.eventMode = 'static';
    this.addChild(this.overlay);
  }

  private createCard(): void {
    this.card = new PIXI.Container();
    this.card.position.set(
      (getCanvasWidth() - this.cardWidth) / 2,
      (getCanvasHeight() - this.cardHeight) / 2
    );
    this.addChild(this.card);

    // Shadow
    const shadow = new PIXI.Graphics();
    shadow.roundRect(0, scale(8), this.cardWidth, this.cardHeight, 0);
    shadow.fill({ color: 0x000000, alpha: 0.2 });
    const blur = new PIXI.BlurFilter();
    blur.strength = scale(10);
    shadow.filters = [blur];
    this.card.addChild(shadow);

    // Background
    const bg = new PIXI.Graphics();
    bg.roundRect(0, 0, this.cardWidth, this.cardHeight, 0);
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
    const headerY = scale(30);

    // Status Badge (Left)
    const badge = new PIXI.Container();
    const badgeBg = new PIXI.Graphics();
    badgeBg.roundRect(0, 0, scale(164), scale(60), scale(30));
    badgeBg.fill(0xF2F2F2);
    badge.addChild(badgeBg);

    const penIcon = new PIXI.Text({
      text: '\uF604',
      style: {
        fontFamily: 'bootstrap-icons',
        fontSize: scale(36),
        fill: 0x555555
      }
    });
    penIcon.position.set(scale(12), scale(16));
    badge.addChild(penIcon);

    const countText = new PIXI.Text({ text: `${PENS.length} / ${PENS.length}`, style: { fontFamily: 'Arial', fontSize: scale(28), fill: 0x555555 } });
    countText.position.set(scale(55), scale(14));
    badge.addChild(countText);

    badge.position.set(scale(30), headerY);
    this.card.addChild(badge);

    // Title (Center)
    const title = new PIXI.Text({ text: LanguageManager.getInstance().t('pen.title'), style: { fontFamily: 'Arial', fontSize: scale(40), fill: 0x3E3E3E } });
    title.anchor.set(0.5, 0);
    title.position.set(this.cardWidth / 2, headerY);
    this.card.addChild(title);

    // Close Button (Right)
    const closeBtn = new PIXI.Container();
    const closeBg = new PIXI.Graphics();
    closeBg.circle(0, 0, scale(25));
    closeBg.fill(0x555555);
    closeBtn.addChild(closeBg);

    const closeText = new PIXI.Text({ text: '×', style: { fontFamily: 'Arial', fontSize: scale(40), fill: 0xFFFFFF } });
    closeText.anchor.set(0.5);
    closeBtn.addChild(closeText);

    closeBtn.position.set(this.cardWidth - scale(30 + 25), headerY + scale(25));
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointertap', this.onCloseCallback);
    this.card.addChild(closeBtn);
  }

  private createCarousel(): void {
    // Mask
    const mask = new PIXI.Graphics();
    mask.rect(0, scale(100), this.cardWidth, scale(300));
    mask.fill(0xFF0000);
    this.card.addChild(mask);

    this.carouselContainer = new PIXI.Container();
    this.carouselContainer.mask = mask;
    this.card.addChild(this.carouselContainer);

    // Create Items
    PENS.forEach((pen, index) => {
      const item = this.createPenItem(pen);
      item.x = index * this.itemSpacing;
      item.y = scale(230);
      this.carouselContainer.addChild(item);
      this.penItems.push(item);
    });
  }

  private createPenItem(pen: Pen): PIXI.Container {
    const item = new PIXI.Container();

    // Visual representation of the pen
    const gfx = new PIXI.Graphics();

    // Pen body
    gfx.rect(scale(-10), scale(-60), scale(20), scale(120));
    gfx.fill(pen.color);

    // Pen tip
    gfx.moveTo(scale(-10), scale(60));
    gfx.lineTo(0, scale(80));
    gfx.lineTo(scale(10), scale(60));
    gfx.fill(0x333333);

    // Apply scaling and rotation
    gfx.scale.set(1.4);
    gfx.angle = 30;

    // Label
    const penName = LanguageManager.getInstance().t(`pen.names.${pen.id}` as TranslationKey);
    const text = new PIXI.Text({ text: penName, style: { fontFamily: 'Arial', fontSize: scale(20), fill: 0x333333 } });
    text.anchor.set(0.5);
    text.y = scale(130);

    item.addChild(gfx);
    item.addChild(text);

    return item;
  }

  private createFooter(): void {
    const btn = new PIXI.Container();
    const btnWidth = scale(210);
    const btnHeight = scale(67);

    const bg = new PIXI.Graphics();
    bg.roundRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, btnHeight / 2);
    bg.fill(0x37A4E9);
    btn.addChild(bg);

    const text = new PIXI.Text({ text: LanguageManager.getInstance().t('pen.use'), style: { fontFamily: 'Arial', fontSize: scale(28), fill: 0xFFFFFF } });
    text.anchor.set(0.5);
    btn.addChild(text);

    btn.position.set(this.cardWidth / 2, this.cardHeight - scale(60));
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
    hitArea.rect(0, scale(100), this.cardWidth, scale(300));
    hitArea.fill({ color: 0x000000, alpha: 0 });
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
      this.targetScrollX = this.scrollX;
    };

    const onDragEnd = (e: PIXI.FederatedPointerEvent) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      hitArea.cursor = 'grab';

      const dragDistance = Math.abs(e.global.x - this.dragStartX);

      if (e.type !== 'pointerupoutside' && dragDistance < 10) {
        const localPoint = this.carouselContainer.toLocal(e.global);
        const index = Math.round(localPoint.x / this.itemSpacing);
        this.centerOnIndex(index);
      } else {
        // Snap to nearest
        const index = Math.round(this.scrollX / this.itemSpacing);
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

    this.targetScrollX = index * this.itemSpacing;
  }

  private update(): void {
    if (!this.card.parent) return; // Don't update if removed

    // Smooth scroll
    if (!this.isDragging) {
      this.scrollX += (this.targetScrollX - this.scrollX) * 0.1;
    }

    // Update container position
    // We want the scrollX point to be at the center of the screen
    // Visual Offset = centerX - scrollX
    this.carouselContainer.x = this.centerX - this.scrollX;

    // Update Scales based on distance from center
    this.penItems.forEach((item) => {
      const itemGlobalX = this.carouselContainer.x + item.x;
      const distFromCenter = Math.abs(itemGlobalX - this.centerX);

      // Scale calculation: 1.0 at center, 0.4 at spacing distance
      let scaleValue = 1.0 - (distFromCenter / this.itemSpacing) * 0.6;
      scaleValue = Math.max(0.4, scaleValue);

      item.scale.set(scaleValue);
      item.alpha = Math.max(0.5, scaleValue);
    });
  }

  destroy(options?: any): void {
    PIXI.Ticker.shared.remove(this.update, this);
    window.removeEventListener('resize', this.handleResize);
    super.destroy(options);
  }
}
